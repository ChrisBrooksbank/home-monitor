// NVIDIA SHIELD Proxy Server
// Provides HTTP API for SHIELD control from the web UI
import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import * as shieldControl from '../../scripts/control/shield-control.js';

// Load environment variables
dotenv.config();

// Re-export types from the module declaration
export type {
    LaunchResult,
    StopResult,
    DeviceInfo,
} from '../../scripts/control/shield-control.js';

// ShieldControl interface for external use
export interface ShieldControl {
    launchApp: typeof shieldControl.launchApp;
    stopApp: typeof shieldControl.stopApp;
    getDeviceInfo: typeof shieldControl.getDeviceInfo;
    APPS?: typeof shieldControl.APPS;
}

const PORT = 8082;

// ========================================
// TYPES
// ========================================

interface LaunchHeaders {
    'x-app-name'?: string;
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
        service: 'shield-proxy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    }));

    // Device info
    fastify.get('/info', async () => {
        console.log('GET /info');
        return shieldControl.getDeviceInfo();
    });

    // List available apps
    fastify.get('/apps', async () => {
        console.log('GET /apps');
        return {
            apps: Object.keys(
                shieldControl.APPS || {
                    netflix: true,
                    youtube: true,
                    plex: true,
                    spotify: true,
                    prime: true,
                    disney: true,
                }
            ),
        };
    });

    // Launch app
    fastify.post<{ Headers: LaunchHeaders }>('/launch', async (request, reply) => {
        const appName = request.headers['x-app-name'];

        console.log(`POST /launch - app: ${appName}`);

        if (!appName) {
            reply.code(400);
            return { error: 'Missing X-App-Name header' };
        }

        return shieldControl.launchApp(appName);
    });

    // Stop app
    fastify.post('/stop', async () => {
        console.log('POST /stop');
        return shieldControl.stopApp();
    });

    return fastify;
}

// ========================================
// START SERVER
// ========================================

async function startServer(): Promise<void> {
    app = createApp();

    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`SHIELD Proxy Server running on http://localhost:${PORT}`);
        console.log('');
        console.log('Available endpoints:');
        console.log(`  POST /launch     - Launch app (header: X-App-Name)`);
        console.log(`  POST /stop       - Stop current app`);
        console.log(`  GET  /info       - Get device info`);
        console.log(`  GET  /apps       - List available apps`);
        console.log(`  GET  /health     - Health check`);
        console.log('');
        console.log('Press Ctrl+C to stop');
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

// Only start server when run directly, not when imported for testing
if (!process.env.VITEST) {
    startServer();
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\nShutting down SHIELD proxy server...');
    if (app) {
        await app.close();
    }
    console.log('Server stopped');
    process.exit(0);
});

// ========================================
// EXPORTS FOR TESTING
// ========================================

export { app, createApp };
