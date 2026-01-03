// Simple CORS proxy for Sonos controls
import http from 'http';
import url from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const PORT = 3000;
const SONOS_PORT = 1400;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

// Known Sonos speakers
const SPEAKERS = {
    'bedroom': '192.168.68.61',
    'office': '192.168.68.75',
    'lounge': '192.168.68.64'
};

const server = http.createServer((req, res) => {
    // Enable CORS with restricted origin
    res.setHeader('Access-Control-Allow-Origin', FRONTEND_ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, SOAPAction, X-Sonos-IP');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Parse request URL
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;

    // GET /health - Health check endpoint
    if (req.method === 'GET' && path === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            service: 'sonos-proxy',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        }));
        return;
    }

    // Get target Sonos IP from custom header
    const targetIP = req.headers['x-sonos-ip'];

    if (!targetIP) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing X-Sonos-IP header');
        return;
    }

    console.log(`${req.method} ${path} -> ${targetIP}`);

    // Proxy POST requests to Sonos
    if (req.method === 'POST') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            const soapAction = req.headers.soapaction || req.headers['soapaction'];

            const options = {
                hostname: targetIP,
                port: SONOS_PORT,
                path: path,
                method: 'POST',
                headers: {
                    'Content-Type': 'text/xml; charset="utf-8"',
                    'SOAPAction': soapAction,
                    'Content-Length': Buffer.byteLength(body)
                }
            };

            const proxyReq = http.request(options, (proxyRes) => {
                let responseData = '';

                proxyRes.on('data', chunk => {
                    responseData += chunk;
                });

                proxyRes.on('end', () => {
                    res.writeHead(proxyRes.statusCode, {
                        'Content-Type': 'text/xml',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(responseData);
                });
            });

            proxyReq.on('error', (error) => {
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

server.listen(PORT, () => {
    console.log(`🔊 Sonos CORS Proxy running on http://localhost:${PORT}`);
    console.log(`   Configured speakers:`);
    for (const [name, ip] of Object.entries(SPEAKERS)) {
        console.log(`   - ${name}: ${ip}`);
    }
    console.log(`\nNow open index.html in your browser to use the controls.`);
});
