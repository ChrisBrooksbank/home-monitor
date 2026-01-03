// NVIDIA SHIELD Proxy Server
// Provides HTTP API for SHIELD control from the web UI

import http from 'http';
import dotenv from 'dotenv';
import * as shieldControl from '../scripts/control/shield-control.js';

// Load environment variables
dotenv.config();

const PORT = 8082; // Different from Sonos proxy (8081)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

const server = http.createServer(async (req, res) => {
    // Enable CORS with restricted origin
    res.setHeader('Access-Control-Allow-Origin', FRONTEND_ORIGIN);
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
            const appName = req.headers['x-app-name'];

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
            res.end(JSON.stringify({
                apps: Object.keys(shieldControl.APPS || {
                    netflix: true,
                    youtube: true,
                    plex: true,
                    spotify: true,
                    prime: true,
                    disney: true
                })
            }));
            return;
        }

        // Health check
        if (req.url === '/health' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'ok',
                service: 'shield-proxy',
                uptime: process.uptime(),
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // 404 for unknown endpoints
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));

    } catch (error) {
        console.error('Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
    }
});

server.listen(PORT, () => {
    console.log(`📺 SHIELD Proxy Server running on http://localhost:${PORT}`);
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

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\nShutting down SHIELD proxy server...');
    server.close(() => {
        console.log('Server stopped');
        process.exit(0);
    });
});
