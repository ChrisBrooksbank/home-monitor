// Tapo Smart Plug Proxy Server
// Allows web interface to control Tapo devices with auto-discovery
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import http from 'http';
import type { ClientRequest, IncomingMessage } from 'http';
import dotenv from 'dotenv';
import { loginDeviceByIp } from 'tp-link-tapo-connect';

// Load environment variables
dotenv.config();

const PORT = 3001;
const BASE_IP = process.env.TAPO_BASE_IP || '192.168.68';
const SCAN_START = parseInt(process.env.TAPO_SCAN_START || '50');
const SCAN_END = parseInt(process.env.TAPO_SCAN_END || '90');

// Load credentials from environment - REQUIRED (skip check in test mode)
const TAPO_EMAIL = process.env.TAPO_EMAIL;
const TAPO_PASSWORD = process.env.TAPO_PASSWORD;

if (!process.env.VITEST && (!TAPO_EMAIL || !TAPO_PASSWORD)) {
    console.error('ERROR: TAPO_EMAIL and TAPO_PASSWORD environment variables are required');
    console.error('Please create a .env file with your Tapo credentials');
    console.error('See .env.example for template');
    process.exit(1);
}

// ========================================
// TYPES
// ========================================

interface TapoPlug {
    ip: string;
    nickname: string;
    model: string;
    mac?: string;
}

interface PlugMap {
    [key: string]: TapoPlug;
}

interface ProbeResult {
    ip: string;
    isTapo: boolean;
}

interface PlugInfo {
    ip: string;
    nickname?: string;
    model?: string;
    mac?: string;
    state?: 'on' | 'off';
    error?: string;
}

interface PlugNameRequest {
    plugName: string;
}

// ========================================
// DYNAMIC STATE
// ========================================

let discoveredPlugs: PlugMap = {};
let lastDiscovery: string | null = null;
let isDiscovering = false;

const REDISCOVERY_INTERVAL = 5 * 60 * 1000;

const MANUAL_PLUGS: PlugMap = {
    'office-plug-2': { ip: '192.168.68.64', nickname: 'office plug 2', model: 'P105' },
};

// ========================================
// DISCOVERY FUNCTIONS
// ========================================

function probeTapo(ip: string, timeout = 3000): Promise<ProbeResult> {
    return new Promise((resolve) => {
        const body = JSON.stringify({ method: 'get_device_info' });
        const req: ClientRequest = http.request(
            {
                hostname: ip,
                port: 80,
                path: '/app',
                method: 'POST',
                timeout: timeout,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                    Accept: '*/*',
                },
            },
            (res: IncomingMessage) => {
                let data = '';
                res.on('data', (chunk: Buffer) => (data += chunk));
                res.on('end', () => {
                    resolve({ ip, isTapo: data.includes('error_code') });
                });
            }
        );
        req.on('error', () => resolve({ ip, isTapo: false }));
        req.on('timeout', () => {
            req.destroy();
            resolve({ ip, isTapo: false });
        });
        req.write(body);
        req.end();
    });
}

async function scanForPlugs(baseIp: string, start: number, end: number, batchSize = 10): Promise<string[]> {
    console.log(`Scanning ${baseIp}.${start}-${end} for Tapo plugs...`);
    const results: ProbeResult[] = [];

    for (let i = start; i <= end; i += batchSize) {
        const batch: Promise<ProbeResult>[] = [];
        for (let j = i; j < Math.min(i + batchSize, end + 1); j++) {
            batch.push(probeTapo(`${baseIp}.${j}`));
        }
        const batchResults = await Promise.all(batch);
        results.push(...batchResults.filter((r) => r.isTapo));
    }

    return results.map((r) => r.ip);
}

async function getPlugInfo(ip: string): Promise<PlugInfo> {
    try {
        const device = await loginDeviceByIp(TAPO_EMAIL!, TAPO_PASSWORD!, ip);
        const info = await device.getDeviceInfo();
        return {
            ip,
            nickname: info.nickname || 'Unknown',
            model: info.model,
            mac: info.mac,
            state: info.device_on ? 'on' : 'off',
        };
    } catch (error) {
        return { ip, error: (error as Error).message };
    }
}

async function discoverAndIdentifyPlugs(): Promise<PlugMap> {
    if (isDiscovering) {
        console.log('Discovery already in progress, skipping...');
        return discoveredPlugs;
    }
    isDiscovering = true;

    try {
        const startTime = Date.now();
        const ips = await scanForPlugs(BASE_IP, SCAN_START, SCAN_END);
        console.log(`   Found ${ips.length} Tapo devices`);

        const plugs: PlugMap = {};
        for (const ip of ips) {
            const info = await getPlugInfo(ip);
            if (!info.error && info.nickname) {
                const key = info.nickname.toLowerCase().replace(/\s+/g, '-');
                plugs[key] = {
                    ip: info.ip,
                    nickname: info.nickname,
                    model: info.model || 'Unknown',
                    mac: info.mac,
                };
                console.log(`   Found: ${info.nickname} @ ${ip}`);
            }
        }

        for (const [key, plug] of Object.entries(MANUAL_PLUGS)) {
            if (!plugs[key]) {
                plugs[key] = plug;
                console.log(`   + ${plug.nickname} @ ${plug.ip} (manual)`);
            }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`Discovery complete in ${elapsed}s - found ${Object.keys(plugs).length} plugs\n`);

        discoveredPlugs = plugs;
        lastDiscovery = new Date().toISOString();

        return plugs;
    } finally {
        isDiscovering = false;
    }
}

function getPlugIP(plugName: string): string | null {
    const plug = discoveredPlugs[plugName];
    return plug ? plug.ip : null;
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

    // Health check
    fastify.get('/health', async () => ({
        status: 'ok',
        service: 'tapo-proxy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    }));

    fastify.head('/health', async (_, reply) => {
        reply.code(200).send();
    });

    // List plugs
    fastify.get('/plugs', async () => ({
        plugs: discoveredPlugs,
        lastDiscovery,
        count: Object.keys(discoveredPlugs).length,
    }));

    fastify.head('/plugs', async (_, reply) => {
        reply.code(200).send();
    });

    // Discover plugs
    fastify.post('/discover', async () => {
        console.log('Manual discovery triggered...');
        const plugs = await discoverAndIdentifyPlugs();
        return {
            success: true,
            plugs,
            count: Object.keys(plugs).length,
            discoveredAt: lastDiscovery,
        };
    });

    // Get plug status
    fastify.post<{ Body: PlugNameRequest }>('/status', async (request, reply) => {
        const { plugName } = request.body;
        const ip = getPlugIP(plugName);

        if (!ip) {
            reply.code(404);
            return { error: 'Plug not found', available: Object.keys(discoveredPlugs) };
        }

        const device = await loginDeviceByIp(TAPO_EMAIL!, TAPO_PASSWORD!, ip);
        const info = await device.getDeviceInfo();

        return {
            success: true,
            plugName,
            ip,
            state: info.device_on ? 'on' : 'off',
            model: info.model,
            nickname: info.nickname,
            rssi: info.rssi,
            onTime: info.on_time,
        };
    });

    // Turn plug on
    fastify.post<{ Body: PlugNameRequest }>('/on', async (request, reply) => {
        const { plugName } = request.body;
        const ip = getPlugIP(plugName);

        if (!ip) {
            reply.code(404);
            return { error: 'Plug not found', available: Object.keys(discoveredPlugs) };
        }

        console.log(`Turning ON ${plugName} (${ip})`);
        const device = await loginDeviceByIp(TAPO_EMAIL!, TAPO_PASSWORD!, ip);
        await device.turnOn();

        return { success: true, state: 'on' };
    });

    // Turn plug off
    fastify.post<{ Body: PlugNameRequest }>('/off', async (request, reply) => {
        const { plugName } = request.body;
        const ip = getPlugIP(plugName);

        if (!ip) {
            reply.code(404);
            return { error: 'Plug not found', available: Object.keys(discoveredPlugs) };
        }

        console.log(`Turning OFF ${plugName} (${ip})`);
        const device = await loginDeviceByIp(TAPO_EMAIL!, TAPO_PASSWORD!, ip);
        await device.turnOff();

        return { success: true, state: 'off' };
    });

    // Toggle plug
    fastify.post<{ Body: PlugNameRequest }>('/toggle', async (request, reply) => {
        const { plugName } = request.body;
        const ip = getPlugIP(plugName);

        if (!ip) {
            reply.code(404);
            return { error: 'Plug not found', available: Object.keys(discoveredPlugs) };
        }

        console.log(`Toggling ${plugName} (${ip})`);
        const device = await loginDeviceByIp(TAPO_EMAIL!, TAPO_PASSWORD!, ip);
        const info = await device.getDeviceInfo();

        if (info.device_on) {
            await device.turnOff();
            return { success: true, state: 'off' };
        } else {
            await device.turnOn();
            return { success: true, state: 'on' };
        }
    });

    return fastify;
}

// ========================================
// START SERVER
// ========================================

async function startServer(): Promise<void> {
    console.log('Tapo Smart Plug Proxy starting...\n');

    app = createApp();

    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`Tapo Proxy running on http://localhost:${PORT}`);
        console.log(`\nEndpoints:`);
        console.log(`   GET  /health   - Health check`);
        console.log(`   GET  /plugs    - List discovered plugs`);
        console.log(`   POST /discover - Re-scan network for plugs`);
        console.log(`   POST /status   - Get plug status`);
        console.log(`   POST /on       - Turn plug on`);
        console.log(`   POST /off      - Turn plug off`);
        console.log(`   POST /toggle   - Toggle plug state`);
        console.log(`\nRunning plug discovery in background...`);
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }

    try {
        await discoverAndIdentifyPlugs();
        console.log(`\nReady! Open index.html in your browser.`);
    } catch (error) {
        console.error('Initial discovery failed:', (error as Error).message);
        console.log('   Use POST /discover to retry\n');
    }

    setInterval(async () => {
        console.log('Running periodic plug discovery...');
        try {
            await discoverAndIdentifyPlugs();
        } catch (error) {
            console.error('Periodic discovery failed:', (error as Error).message);
        }
    }, REDISCOVERY_INTERVAL);
    console.log(`Periodic re-discovery scheduled every ${REDISCOVERY_INTERVAL / 60000} minutes`);
}

// Only start server when run directly, not when imported for testing
if (!process.env.VITEST) {
    startServer();
}

// ========================================
// EXPORTS FOR TESTING
// ========================================

export {
    probeTapo,
    scanForPlugs,
    getPlugInfo,
    discoverAndIdentifyPlugs,
    getPlugIP,
    discoveredPlugs,
    MANUAL_PLUGS,
    REDISCOVERY_INTERVAL,
    app,
    createApp,
};

export function _setDiscoveredPlugs(plugs: PlugMap): void {
    Object.keys(discoveredPlugs).forEach((k) => delete discoveredPlugs[k]);
    Object.assign(discoveredPlugs, plugs);
}

export function _resetDiscoveredPlugs(): void {
    Object.keys(discoveredPlugs).forEach((k) => delete discoveredPlugs[k]);
}

export type { TapoPlug, PlugMap, ProbeResult, PlugInfo, PlugNameRequest };
