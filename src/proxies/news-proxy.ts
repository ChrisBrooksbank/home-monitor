// News RSS Proxy - Fetches Google News RSS and returns JSON headlines
import http from 'http';
import https from 'https';
import type { IncomingMessage, ServerResponse, Server } from 'http';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const PORT = 3002;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const ALLOWED_ORIGINS: (string | RegExp)[] = [FRONTEND_ORIGIN, /^http:\/\/localhost:\d+$/];

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
// HTTP SERVER
// ========================================

function isAllowedOrigin(origin: string | undefined): boolean {
    if (!origin) return true;
    return ALLOWED_ORIGINS.some((allowed) =>
        allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
    );
}

const server: Server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // CORS headers
    const origin = req.headers.origin || FRONTEND_ORIGIN;
    const allowedOrigin = isAllowedOrigin(origin) ? origin : FRONTEND_ORIGIN;
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const path = (req.url || '').split('?')[0];

    // GET /health - Health check
    if (req.method === 'GET' && path === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
            JSON.stringify({
                status: 'ok',
                service: 'news-proxy',
                uptime: process.uptime(),
                cachedHeadlines: cachedHeadlines.length,
                lastFetch: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
                timestamp: new Date().toISOString(),
            })
        );
        return;
    }

    // GET /headlines - All cached headlines
    if (req.method === 'GET' && path === '/headlines') {
        try {
            const headlines = await getHeadlines();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
                JSON.stringify({
                    headlines,
                    count: headlines.length,
                    lastFetch: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
                })
            );
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: (error as Error).message }));
        }
        return;
    }

    // GET /random - Single random headline
    if (req.method === 'GET' && path === '/random') {
        try {
            const headline = await getRandomHeadline();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(headline));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: (error as Error).message }));
        }
        return;
    }

    // 404 for unknown routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
});

// Start server
async function startServer(): Promise<void> {
    console.log('Starting News Proxy...\n');

    // Initial fetch
    await refreshHeadlines();

    server.listen(PORT, () => {
        console.log(`News Proxy running on http://localhost:${PORT}`);
        console.log(`\nEndpoints:`);
        console.log(`   GET  /health    - Health check`);
        console.log(`   GET  /headlines - All cached headlines`);
        console.log(`   GET  /random    - Single random headline`);
        console.log(`\nReady!`);
    });
}

startServer();

// ========================================
// EXPORTS FOR TESTING
// ========================================
export {
    parseRSS,
    isAllowedOrigin,
    fetchRSS,
    getHeadlines,
    getRandomHeadline,
    refreshHeadlines,
    // Export cache state for testing
    cachedHeadlines,
    lastFetchTime,
    CACHE_DURATION,
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
