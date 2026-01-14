// News RSS Proxy - Fetches Google News RSS and returns JSON headlines
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import https from 'https';
import type { IncomingMessage } from 'http';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const PORT = 3002;

// Google News RSS for UK
const RSS_URL = 'https://news.google.com/rss?hl=en-GB&gl=GB&ceid=GB:en';

// Cache settings
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// ========================================
// TYPES
// ========================================

interface Headline {
    headline: string;
    link: string;
    source: string;
    pubDate: string | null;
}

// ========================================
// CACHE STATE
// ========================================

let cachedHeadlines: Headline[] = [];
let lastFetchTime: number | null = null;

// ========================================
// RSS FETCHING & PARSING
// ========================================

/**
 * Fetch RSS feed via HTTPS
 */
function fetchRSS(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const request = https.get(url, { timeout: 10000 }, (res: IncomingMessage) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                // Handle redirect
                const location = res.headers.location;
                if (location) {
                    fetchRSS(location).then(resolve).catch(reject);
                } else {
                    reject(new Error('Redirect without location header'));
                }
                return;
            }

            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }

            let data = '';
            res.on('data', (chunk: Buffer) => (data += chunk));
            res.on('end', () => resolve(data));
        });

        request.on('error', reject);
        request.on('timeout', function (this: typeof request) {
            this.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

/**
 * Parse RSS XML to extract headlines
 * Simple regex-based parsing (no XML library needed)
 */
function parseRSS(xml: string): Headline[] {
    const items: Headline[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 20) {
        const itemXml = match[1];

        const titleMatch =
            itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
            itemXml.match(/<title>(.*?)<\/title>/);
        const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
        const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/);
        const sourceMatch = itemXml.match(/<source[^>]*>(.*?)<\/source>/);

        if (titleMatch && linkMatch) {
            // Clean up title (remove source suffix like " - BBC News")
            let title = titleMatch[1].trim();
            const dashIndex = title.lastIndexOf(' - ');
            if (dashIndex > 0) {
                title = title.substring(0, dashIndex);
            }

            items.push({
                headline: title,
                link: linkMatch[1].trim(),
                source: sourceMatch ? sourceMatch[1].trim() : 'News',
                pubDate: pubDateMatch ? pubDateMatch[1].trim() : null,
            });
        }
    }

    return items;
}

/**
 * Refresh headlines from RSS feed
 */
async function refreshHeadlines(): Promise<Headline[]> {
    try {
        console.log('Fetching Google News RSS...');
        const xml = await fetchRSS(RSS_URL);
        cachedHeadlines = parseRSS(xml);
        lastFetchTime = Date.now();
        console.log(`Cached ${cachedHeadlines.length} headlines`);
        return cachedHeadlines;
    } catch (error) {
        console.error('Failed to fetch RSS:', (error as Error).message);
        return cachedHeadlines; // Return stale cache on error
    }
}

/**
 * Get headlines (from cache or fresh fetch)
 */
async function getHeadlines(): Promise<Headline[]> {
    const now = Date.now();
    if (!lastFetchTime || now - lastFetchTime > CACHE_DURATION) {
        await refreshHeadlines();
    }
    return cachedHeadlines;
}

/**
 * Get a random headline
 */
async function getRandomHeadline(): Promise<Headline> {
    const headlines = await getHeadlines();
    if (headlines.length === 0) {
        return {
            headline: 'Check local news at news.google.com',
            link: 'https://news.google.com',
            source: 'Google News',
            pubDate: null,
        };
    }
    return headlines[Math.floor(Math.random() * headlines.length)];
}

// ========================================
// FASTIFY SERVER (only created when not testing)
// ========================================

let app: FastifyInstance | null = null;

function createApp(): FastifyInstance {
    const fastify = Fastify({ logger: false });

    // Register CORS
    fastify.register(cors, {
        origin: [/^http:\/\/localhost:\d+$/],
        methods: ['GET', 'HEAD', 'OPTIONS'],
    });

    // Health check
    fastify.get('/health', async () => ({
        status: 'ok',
        service: 'news-proxy',
        uptime: process.uptime(),
        cachedHeadlines: cachedHeadlines.length,
        lastFetch: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
        timestamp: new Date().toISOString(),
    }));

    fastify.head('/health', async (_, reply) => {
        reply.code(200).send();
    });

    // All cached headlines
    fastify.get('/headlines', async () => {
        const headlines = await getHeadlines();
        return {
            headlines,
            count: headlines.length,
            lastFetch: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
        };
    });

    fastify.head('/headlines', async (_, reply) => {
        reply.code(200).send();
    });

    // Single random headline
    fastify.get('/random', async () => {
        return getRandomHeadline();
    });

    fastify.head('/random', async (_, reply) => {
        reply.code(200).send();
    });

    return fastify;
}

// ========================================
// START SERVER
// ========================================

async function startServer(): Promise<void> {
    console.log('Starting News Proxy...\n');

    // Initial fetch
    await refreshHeadlines();

    app = createApp();

    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`News Proxy running on http://localhost:${PORT}`);
        console.log(`\nEndpoints:`);
        console.log(`   GET  /health    - Health check`);
        console.log(`   GET  /headlines - All cached headlines`);
        console.log(`   GET  /random    - Single random headline`);
        console.log(`\nReady!`);
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

// Only start server when run directly, not when imported for testing
if (!process.env.VITEST) {
    startServer();
}

// ========================================
// EXPORTS FOR TESTING
// ========================================

export {
    parseRSS,
    fetchRSS,
    getHeadlines,
    getRandomHeadline,
    refreshHeadlines,
    cachedHeadlines,
    lastFetchTime,
    CACHE_DURATION,
    app,
    createApp,
};

// Allow tests to reset cache state
export function _resetCache(): void {
    cachedHeadlines = [];
    lastFetchTime = null;
}

export function _setCache(headlines: Headline[], fetchTime: number | null): void {
    cachedHeadlines = headlines;
    lastFetchTime = fetchTime;
}

// Export types
export type { Headline };
