// NVIDIA SHIELD Proxy Server
// Provides HTTP API for SHIELD control from the web UI

import http from 'http';
import type { IncomingMessage, ServerResponse, Server } from 'http';
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

const PORT = 8082; // Different from Sonos proxy (8081)
// Allow any localhost port for development flexibility
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const ALLOWED_ORIGINS: (string | RegExp)[] = [FRONTEND_ORIGIN, /^http:\/\/localhost:\d+$/];

function isAllowedOrigin(origin: string | undefined): boolean {
    if (!origin) return true;
    return ALLOWED_ORIGINS.some((allowed) =>
        allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
    );
}

const server: Server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Enable CORS - allow any localhost port for dev flexibility
    const origin = req.headers.origin || FRONTEND_ORIGIN;
    const allowedOrigin = isAllowedOrigin(origin) ? origin : FRONTEND_ORIGIN;
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Name');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    console.log(`${req.method} ${req.url}`);

    try {
        // Launch app endpoint
        if (req.url === '/launch' && req.method === 'POST') {
            const appName = req.headers['x-app-name'] as string | undefined;

            if (!appName) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Missing X-App-Name header' }));
                return;
            }

            const result = await shieldControl.launchApp(appName);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return;
        }

        // Device info endpoint
        if (req.url === '/info' && req.method === 'GET') {
            const info = await shieldControl.getDeviceInfo();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(info));
            return;
        }

        // Stop app endpoint
        if (req.url === '/stop' && req.method === 'POST') {
            const result = await shieldControl.stopApp();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return;
        }

        // List available apps
        if (req.url === '/apps' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
                JSON.stringify({
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
                })
            );
            return;
        }

        // Health check
        if (req.url === '/health' && (req.method === 'GET' || req.method === 'HEAD')) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            if (req.method === 'HEAD') {
                res.end();
            } else {
                res.end(
                    JSON.stringify({
                        status: 'ok',
                        service: 'shield-proxy',
                        uptime: process.uptime(),
                        timestamp: new Date().toISOString(),
                    })
                );
            }
            return;
        }

        // 404 for unknown endpoints
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    } catch (error) {
        console.error('Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: (error as Error).message }));
    }
});

// Start server
function startServer(): void {
    server.listen(PORT, () => {
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
    });
}

startServer();

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\nShutting down SHIELD proxy server...');
    server.close(() => {
        console.log('Server stopped');
        process.exit(0);
    });
});

// ========================================
// EXPORTS FOR TESTING
// ========================================
export { isAllowedOrigin };
