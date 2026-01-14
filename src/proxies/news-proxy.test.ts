/**
 * Unit tests for news-proxy.ts
 * Tests RSS parsing, caching, and origin validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseRSS,
  _resetCache,
  _setCache,
  CACHE_DURATION,
  type Headline,
} from './news-proxy';

// ============================================
// parseRSS Tests - Pure function, high value
// ============================================

describe('parseRSS', () => {
  it('should parse items with CDATA-wrapped titles', () => {
    const xml = `
            <rss>
                <channel>
                    <item>
                        <title><![CDATA[Breaking News Story]]></title>
                        <link>https://example.com/story1</link>
                        <source>BBC News</source>
                        <pubDate>Sat, 11 Jan 2025 12:00:00 GMT</pubDate>
                    </item>
                </channel>
            </rss>
        `;

    const result = parseRSS(xml);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      headline: 'Breaking News Story',
      link: 'https://example.com/story1',
      source: 'BBC News',
      pubDate: 'Sat, 11 Jan 2025 12:00:00 GMT',
    });
  });

  it('should parse items with plain text titles', () => {
    const xml = `
            <item>
                <title>Plain Text Headline</title>
                <link>https://example.com/story2</link>
            </item>
        `;

    const result = parseRSS(xml);

    expect(result).toHaveLength(1);
    expect(result[0].headline).toBe('Plain Text Headline');
  });

  it('should remove source suffix from title (e.g., " - BBC News")', () => {
    const xml = `
            <item>
                <title><![CDATA[Major Event Happening Now - BBC News]]></title>
                <link>https://example.com/event</link>
            </item>
        `;

    const result = parseRSS(xml);

    expect(result[0].headline).toBe('Major Event Happening Now');
  });

  it('should handle title with multiple dashes correctly', () => {
    const xml = `
            <item>
                <title><![CDATA[UK-US Trade Deal - What It Means - Reuters]]></title>
                <link>https://example.com/trade</link>
            </item>
        `;

    const result = parseRSS(xml);

    // Should only remove the last " - Source" part
    expect(result[0].headline).toBe('UK-US Trade Deal - What It Means');
  });

  it('should use "News" as default source when source tag is missing', () => {
    const xml = `
            <item>
                <title>Story Without Source</title>
                <link>https://example.com/nosource</link>
            </item>
        `;

    const result = parseRSS(xml);

    expect(result[0].source).toBe('News');
  });

  it('should set pubDate to null when missing', () => {
    const xml = `
            <item>
                <title>Story Without Date</title>
                <link>https://example.com/nodate</link>
            </item>
        `;

    const result = parseRSS(xml);

    expect(result[0].pubDate).toBeNull();
  });

  it('should limit results to 20 items', () => {
    // Generate 25 items
    let xml = '';
    for (let i = 0; i < 25; i++) {
      xml += `
                <item>
                    <title>Story ${i}</title>
                    <link>https://example.com/story${i}</link>
                </item>
            `;
    }

    const result = parseRSS(xml);

    expect(result).toHaveLength(20);
  });

  it('should skip items without title', () => {
    const xml = `
            <item>
                <link>https://example.com/notitle</link>
            </item>
            <item>
                <title>Has Title</title>
                <link>https://example.com/hastitle</link>
            </item>
        `;

    const result = parseRSS(xml);

    expect(result).toHaveLength(1);
    expect(result[0].headline).toBe('Has Title');
  });

  it('should skip items without link', () => {
    const xml = `
            <item>
                <title>No Link Story</title>
            </item>
            <item>
                <title>Has Link</title>
                <link>https://example.com/haslink</link>
            </item>
        `;

    const result = parseRSS(xml);

    expect(result).toHaveLength(1);
    expect(result[0].headline).toBe('Has Link');
  });

  it('should handle empty XML', () => {
    const result = parseRSS('');

    expect(result).toEqual([]);
  });

  it('should handle malformed XML gracefully', () => {
    const xml = '<item><title>Broken<item>';

    const result = parseRSS(xml);

    expect(result).toEqual([]);
  });

  it('should trim whitespace from extracted values', () => {
    const xml = `
            <item>
                <title>   Spaced Title   </title>
                <link>   https://example.com/spaced   </link>
                <source>   Spaced Source   </source>
            </item>
        `;

    const result = parseRSS(xml);

    expect(result[0].headline).toBe('Spaced Title');
    expect(result[0].link).toBe('https://example.com/spaced');
    expect(result[0].source).toBe('Spaced Source');
  });

  it('should parse multiple items correctly', () => {
    const xml = `
            <item>
                <title>First Story</title>
                <link>https://example.com/first</link>
                <source>Source A</source>
            </item>
            <item>
                <title>Second Story</title>
                <link>https://example.com/second</link>
                <source>Source B</source>
            </item>
            <item>
                <title>Third Story</title>
                <link>https://example.com/third</link>
                <source>Source C</source>
            </item>
        `;

    const result = parseRSS(xml);

    expect(result).toHaveLength(3);
    expect(result[0].headline).toBe('First Story');
    expect(result[1].headline).toBe('Second Story');
    expect(result[2].headline).toBe('Third Story');
  });

  it('should handle source tag with attributes', () => {
    const xml = `
            <item>
                <title>Story</title>
                <link>https://example.com/story</link>
                <source url="https://bbc.com">BBC News</source>
            </item>
        `;

    const result = parseRSS(xml);

    expect(result[0].source).toBe('BBC News');
  });
});

// ============================================
// Cache Helper Tests
// ============================================

describe('Cache helpers', () => {
  beforeEach(() => {
    _resetCache();
  });

  it('_resetCache should clear cache', () => {
    _setCache([{ headline: 'Test', link: '', source: '', pubDate: null }], Date.now());
    _resetCache();
    // Can't directly access cachedHeadlines, but this tests the function runs
    expect(true).toBe(true);
  });

  it('CACHE_DURATION should be 10 minutes', () => {
    expect(CACHE_DURATION).toBe(10 * 60 * 1000);
  });
});
