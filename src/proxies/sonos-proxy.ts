// Sonos CORS Proxy with Auto-Discovery
// Allows web interface to control Sonos speakers
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import http from 'http';
import type { IncomingMessage, ClientRequest } from 'http';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const PORT = 3000;
const SONOS_PORT = 1400;
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

interface SonosProxyRequest {
    Headers: {
        'x-sonos-ip'?: string;
        soapaction?: string;
    };
}

// ========================================
// DYNAMIC STATE
// ========================================

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

// ========================================
// FASTIFY SERVER (only created when not testing)
// ========================================

let app: FastifyInstance | null = null;

function createApp(): FastifyInstance {
    const fastify = Fastify({ logger: false });

    // Register CORS
    fastify.register(cors, {
        origin: [/^http:\/\/localhost:\d+$/],
        methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
    });

    // Health check (Fastify auto-creates HEAD for GET routes)
    fastify.get('/health', async () => ({
        status: 'ok',
        service: 'sonos-proxy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    }));


    // List speakers
    fastify.get('/speakers', async () => ({
        speakers: discoveredSpeakers,
        lastDiscovery,
        count: Object.keys(discoveredSpeakers).length,
    }));


    // Discover speakers
    fastify.post('/discover', async () => {
        console.log('Manual discovery triggered...');
        const speakers = await discoverSpeakers();
        return {
            success: true,
            speakers,
            count: Object.keys(speakers).length,
            discoveredAt: lastDiscovery,
        };
    });

    // Proxy SOAP requests to Sonos speakers
    fastify.post<{ Headers: SonosProxyRequest['Headers'] }>('/*', async (request, reply) => {
        const targetIP = request.headers['x-sonos-ip'];

        if (!targetIP) {
            reply.code(400);
            return { error: 'Missing X-Sonos-IP header' };
        }

        const path = request.url;
        const soapAction = request.headers.soapaction;
        const body = request.body as string;

        console.log(`POST ${path} -> ${targetIP}`);

        return new Promise((resolve) => {
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
                    reply
                        .code(proxyRes.statusCode || 500)
                        .header('Content-Type', 'text/xml')
                        .send(responseData);
                    resolve(undefined);
                });
            });

            proxyReq.on('error', (error: Error) => {
                console.error('Proxy error:', error);
                reply.code(500).send({ error: `Proxy error: ${error.message}` });
                resolve(undefined);
            });

            proxyReq.write(body);
            proxyReq.end();
        });
    });

    return fastify;
}

// ========================================
// START SERVER
// ========================================

async function startServer(): Promise<void> {
    console.log('Sonos Proxy starting...\n');

    // Run initial discovery
    try {
        await discoverSpeakers();
    } catch (error) {
        console.error('Initial discovery failed:', (error as Error).message);
        console.log('   Proxy will start anyway - use POST /discover to retry\n');
    }

    app = createApp();

    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`Sonos Proxy running on http://localhost:${PORT}`);
        console.log(`\nEndpoints:`);
        console.log(`   GET  /health   - Health check`);
        console.log(`   GET  /speakers - List discovered speakers`);
        console.log(`   POST /discover - Re-scan network for speakers`);
        console.log(`   POST /*        - Proxy SOAP requests to Sonos`);
        console.log(`\nReady! Open index.html in your browser.`);
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
    probeSonos,
    scanForSpeakers,
    discoverSpeakers,
    getSpeakerIP,
    discoveredSpeakers,
    lastDiscovery,
    app,
    createApp,
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
