// Sonos CORS Proxy with Auto-Discovery
import http from 'http';
import type { IncomingMessage, ServerResponse, ClientRequest } from 'http';
import url from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const PORT = 3000;
const SONOS_PORT = 1400;
// Allow any localhost port for development flexibility
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const ALLOWED_ORIGINS: (string | RegExp)[] = [FRONTEND_ORIGIN, /^http:\/\/localhost:\d+$/];
const BASE_IP = process.env.SONOS_BASE_IP || '192.168.68';
const SCAN_START = parseInt(process.env.SONOS_SCAN_START || '50');
const SCAN_END = parseInt(process.env.SONOS_SCAN_END || '90');

// ========================================
// TYPES
// ========================================

interface SonosSpeaker {
    ip: string;
    room: string;
    model: string;
}

interface SpeakerMap {
    [key: string]: SonosSpeaker;
}

interface ProbeResult {
    ip: string;
    isSonos: boolean;
    room?: string;
    model?: string;
}

// ========================================
// DYNAMIC STATE
// ========================================

// Dynamic speaker storage (populated by discovery)
let discoveredSpeakers: SpeakerMap = {};
let lastDiscovery: string | null = null;

// ========================================
// DISCOVERY FUNCTIONS
// ========================================

/**
 * Probe a single IP for Sonos API (port 1400)
 */
function probeSonos(ip: string, timeout = 2000): Promise<ProbeResult> {
    return new Promise((resolve) => {
        const req: ClientRequest = http.request(
            {
                hostname: ip,
                port: SONOS_PORT,
                path: '/xml/device_description.xml',
                method: 'GET',
                timeout: timeout,
            },
            (res: IncomingMessage) => {
                let data = '';
                res.on('data', (chunk: Buffer) => (data += chunk));
                res.on('end', () => {
                    // Sonos devices return XML with modelName containing "Sonos"
                    if (data.includes('Sonos') || data.includes('sonos')) {
                        // Extract room name from XML
                        const roomMatch = data.match(/<roomName>([^<]+)<\/roomName>/);
                        const modelMatch = data.match(/<modelName>([^<]+)<\/modelName>/);
                        const room = roomMatch ? roomMatch[1] : 'Unknown';
                        const model = modelMatch ? modelMatch[1] : 'Sonos';

                        resolve({
                            ip,
                            isSonos: true,
                            room,
                            model,
                        });
                    } else {
                        resolve({ ip, isSonos: false });
                    }
                });
            }
        );

        req.on('error', () => resolve({ ip, isSonos: false }));
        req.on('timeout', () => {
            req.destroy();
            resolve({ ip, isSonos: false });
        });
        req.end();
    });
}

/**
 * Scan network for Sonos speakers
 */
async function scanForSpeakers(
    baseIp: string,
    start: number,
    end: number,
    batchSize = 10
): Promise<ProbeResult[]> {
    console.log(`Scanning ${baseIp}.${start}-${end} for Sonos speakers...`);
    const results: ProbeResult[] = [];

    for (let i = start; i <= end; i += batchSize) {
        const batch: Promise<ProbeResult>[] = [];
        for (let j = i; j < Math.min(i + batchSize, end + 1); j++) {
            batch.push(probeSonos(`${baseIp}.${j}`));
        }
        const batchResults = await Promise.all(batch);
        results.push(...batchResults.filter((r) => r.isSonos));
    }

    return results;
}

/**
 * Discover all Sonos speakers
 */
async function discoverSpeakers(): Promise<SpeakerMap> {
    const startTime = Date.now();

    const speakers = await scanForSpeakers(BASE_IP, SCAN_START, SCAN_END);

    // Track room name counts to handle duplicates
    const roomCounts: Record<string, number> = {};
    const speakerMap: SpeakerMap = {};

    for (const speaker of speakers) {
        let baseKey = (speaker.room || 'unknown').toLowerCase().replace(/\s+/g, '-');

        // Handle duplicate room names (e.g., grouped speakers)
        if (roomCounts[baseKey] === undefined) {
            roomCounts[baseKey] = 0;
        }
        roomCounts[baseKey]++;

        // Add suffix for duplicates: lounge, lounge-2, lounge-3
        const key = roomCounts[baseKey] === 1 ? baseKey : `${baseKey}-${roomCounts[baseKey]}`;

        speakerMap[key] = {
            ip: speaker.ip,
            room: speaker.room || 'Unknown',
            model: speaker.model || 'Sonos',
        };
        console.log(`   Found: ${speaker.room} (${speaker.model}) @ ${speaker.ip} [${key}]`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Discovery complete in ${elapsed}s - found ${speakers.length} speakers\n`);

    discoveredSpeakers = speakerMap;
    lastDiscovery = new Date().toISOString();

    return speakerMap;
}

/**
 * Get IP for a speaker by room name
 */
function getSpeakerIP(roomName: string): string | null {
    const speaker = discoveredSpeakers[roomName];
    return speaker ? speaker.ip : null;
}

function isAllowedOrigin(origin: string | undefined): boolean {
    if (!origin) return true; // Allow requests with no origin (e.g., curl)
    return ALLOWED_ORIGINS.some((allowed) =>
        allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
    );
}

const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Enable CORS - allow any localhost port for dev flexibility
    const origin = req.headers.origin || FRONTEND_ORIGIN;
    const allowedOrigin = isAllowedOrigin(origin) ? origin : FRONTEND_ORIGIN;
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, SOAPAction, X-Sonos-IP');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Parse request URL
    const parsedUrl = url.parse(req.url || '', true);
    const path = parsedUrl.pathname || '';

    // GET /health - Health check endpoint
    if (req.method === 'GET' && path === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
            JSON.stringify({
                status: 'ok',
                service: 'sonos-proxy',
                uptime: process.uptime(),
                timestamp: new Date().toISOString(),
            })
        );
        return;
    }

    // GET /speakers - List all discovered speakers
    if (req.method === 'GET' && path === '/speakers') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
            JSON.stringify({
                speakers: discoveredSpeakers,
                lastDiscovery,
                count: Object.keys(discoveredSpeakers).length,
            })
        );
        return;
    }

    // POST /discover - Trigger speaker discovery
    if (req.method === 'POST' && path === '/discover') {
        try {
            console.log('Manual discovery triggered...');
            const speakers = await discoverSpeakers();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
                JSON.stringify({
                    success: true,
                    speakers,
                    count: Object.keys(speakers).length,
                    discoveredAt: lastDiscovery,
                })
            );
        } catch (error) {
            console.error('Discovery error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: (error as Error).message }));
        }
        return;
    }

    // Get target Sonos IP from custom header
    const targetIP = req.headers['x-sonos-ip'] as string | undefined;

    if (!targetIP) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing X-Sonos-IP header');
        return;
    }

    console.log(`${req.method} ${path} -> ${targetIP}`);

    // Proxy POST requests to Sonos
    if (req.method === 'POST') {
        let body = '';

        req.on('data', (chunk: Buffer) => {
            body += chunk.toString();
        });

        req.on('end', () => {
            const soapAction =
                (req.headers.soapaction as string) || (req.headers['soapaction'] as string);

            const options = {
                hostname: targetIP,
                port: SONOS_PORT,
                path: path,
                method: 'POST',
                headers: {
                    'Content-Type': 'text/xml; charset="utf-8"',
                    SOAPAction: soapAction,
                    'Content-Length': Buffer.byteLength(body),
                },
            };

            const proxyReq = http.request(options, (proxyRes: IncomingMessage) => {
                let responseData = '';

                proxyRes.on('data', (chunk: Buffer) => {
                    responseData += chunk;
                });

                proxyRes.on('end', () => {
                    res.writeHead(proxyRes.statusCode || 500, {
                        'Content-Type': 'text/xml',
                        'Access-Control-Allow-Origin': '*',
                    });
                    res.end(responseData);
                });
            });

            proxyReq.on('error', (error: Error) => {
                console.error('Proxy error:', error);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`Proxy error: ${error.message}`);
            });

            proxyReq.write(body);
            proxyReq.end();
        });
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// Start server with auto-discovery
async function startServer(): Promise<void> {
    console.log('Sonos Proxy starting...\n');

    // Run initial discovery
    try {
        await discoverSpeakers();
    } catch (error) {
        console.error('Initial discovery failed:', (error as Error).message);
        console.log('   Proxy will start anyway - use POST /discover to retry\n');
    }

    server.listen(PORT, () => {
        console.log(`Sonos Proxy running on http://localhost:${PORT}`);
        console.log(`\nEndpoints:`);
        console.log(`   GET  /speakers - List discovered speakers`);
        console.log(`   POST /discover - Re-scan network for speakers`);
        console.log(`   POST /*        - Proxy SOAP requests to Sonos`);
        console.log(`\nReady! Open index.html in your browser.`);
    });
}

startServer();

// ========================================
// EXPORTS FOR TESTING
// ========================================
export {
    probeSonos,
    scanForSpeakers,
    discoverSpeakers,
    getSpeakerIP,
    isAllowedOrigin,
    discoveredSpeakers,
    lastDiscovery,
};

// Test helpers
export function _setDiscoveredSpeakers(speakers: SpeakerMap): void {
    Object.keys(discoveredSpeakers).forEach((k) => delete discoveredSpeakers[k]);
    Object.assign(discoveredSpeakers, speakers);
}

export function _resetDiscoveredSpeakers(): void {
    Object.keys(discoveredSpeakers).forEach((k) => delete discoveredSpeakers[k]);
}

// Export types
export type { SonosSpeaker, SpeakerMap, ProbeResult };
