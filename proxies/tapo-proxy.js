// Tapo Smart Plug Proxy Server
// Allows web interface to control Tapo devices with auto-discovery
import http from 'http';
import dotenv from 'dotenv';
import { loginDeviceByIp } from 'tp-link-tapo-connect';

// Load environment variables
dotenv.config();

const PORT = 3001;
// Allow any localhost port for development flexibility
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const ALLOWED_ORIGINS = [FRONTEND_ORIGIN, /^http:\/\/localhost:\d+$/];
const BASE_IP = process.env.TAPO_BASE_IP || '192.168.68';

function isAllowedOrigin(origin) {
    if (!origin) return true;
    return ALLOWED_ORIGINS.some(allowed =>
        allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
    );
}
const SCAN_START = parseInt(process.env.TAPO_SCAN_START || '50');
const SCAN_END = parseInt(process.env.TAPO_SCAN_END || '90');

// Load credentials from environment - REQUIRED
const TAPO_EMAIL = process.env.TAPO_EMAIL;
const TAPO_PASSWORD = process.env.TAPO_PASSWORD;

if (!TAPO_EMAIL || !TAPO_PASSWORD) {
    console.error('ERROR: TAPO_EMAIL and TAPO_PASSWORD environment variables are required');
    console.error('Please create a .env file with your Tapo credentials');
    console.error('See .env.example for template');
    process.exit(1);
}

// Dynamic plug storage (populated by discovery)
let discoveredPlugs = {};
let lastDiscovery = null;
let isDiscovering = false;

// Re-discovery interval (5 minutes)
const REDISCOVERY_INTERVAL = 5 * 60 * 1000;

// Manual plug overrides for devices that don't respond to probe correctly
const MANUAL_PLUGS = {
    'office-plug-2': { ip: '192.168.68.64', nickname: 'office plug 2', model: 'P105' }
};

// ========================================
// DISCOVERY FUNCTIONS
// ========================================

/**
 * Probe a single IP for Tapo API (no auth needed)
 */
function probeTapo(ip, timeout = 3000) {
    return new Promise((resolve) => {
        const body = JSON.stringify({ method: 'get_device_info' });
        const req = http.request({
            hostname: ip,
            port: 80,
            path: '/app',
            method: 'POST',
            timeout: timeout,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'Accept': '*/*'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (data.includes('error_code')) {
                    resolve({ ip, isTapo: true });
                } else {
                    resolve({ ip, isTapo: false });
                }
            });
        });

        req.on('error', () => resolve({ ip, isTapo: false }));
        req.on('timeout', () => { req.destroy(); resolve({ ip, isTapo: false }); });
        req.write(body);
        req.end();
    });
}

/**
 * Scan network for Tapo plugs
 */
async function scanForPlugs(baseIp, start, end, batchSize = 10) {
    console.log(`🔍 Scanning ${baseIp}.${start}-${end} for Tapo plugs...`);
    const results = [];

    for (let i = start; i <= end; i += batchSize) {
        const batch = [];
        for (let j = i; j < Math.min(i + batchSize, end + 1); j++) {
            batch.push(probeTapo(`${baseIp}.${j}`));
        }
        const batchResults = await Promise.all(batch);
        results.push(...batchResults.filter(r => r.isTapo));
    }

    return results.map(r => r.ip);
}

/**
 * Get device info for a discovered plug
 */
async function getPlugInfo(ip) {
    try {
        const device = await loginDeviceByIp(TAPO_EMAIL, TAPO_PASSWORD, ip);
        const info = await device.getDeviceInfo();
        return {
            ip,
            nickname: info.nickname || 'Unknown',
            model: info.model,
            mac: info.mac,
            state: info.device_on ? 'on' : 'off'
        };
    } catch (error) {
        return { ip, error: error.message };
    }
}

/**
 * Discover all plugs and identify them
 */
async function discoverAndIdentifyPlugs() {
    // Prevent overlapping discovery runs
    if (isDiscovering) {
        console.log('⏳ Discovery already in progress, skipping...');
        return discoveredPlugs;
    }
    isDiscovering = true;

    try {
        const startTime = Date.now();

        // Step 1: Scan for Tapo devices
        const ips = await scanForPlugs(BASE_IP, SCAN_START, SCAN_END);
        console.log(`   Found ${ips.length} Tapo devices`);

        // Step 2: Get info for each plug
        const plugs = {};
        for (const ip of ips) {
            const info = await getPlugInfo(ip);
            if (!info.error && info.nickname) {
                const key = info.nickname.toLowerCase().replace(/\s+/g, '-');
                plugs[key] = {
                    ip: info.ip,
                    nickname: info.nickname,
                    model: info.model,
                    mac: info.mac
                };
                console.log(`   ✓ ${info.nickname} @ ${ip}`);
            }
        }

        // Merge manual plugs that weren't discovered
        for (const [key, plug] of Object.entries(MANUAL_PLUGS)) {
            if (!plugs[key]) {
                plugs[key] = plug;
                console.log(`   + ${plug.nickname} @ ${plug.ip} (manual)`);
            }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ Discovery complete in ${elapsed}s - found ${Object.keys(plugs).length} plugs\n`);

        discoveredPlugs = plugs;
        lastDiscovery = new Date().toISOString();

        return plugs;
    } finally {
        isDiscovering = false;
    }
}

/**
 * Get IP for a plug by name (searches discovered plugs)
 */
function getPlugIP(plugName) {
    const plug = discoveredPlugs[plugName];
    return plug ? plug.ip : null;
}

const server = http.createServer(async (req, res) => {
    // Enable CORS - allow any localhost port for dev flexibility
    const origin = req.headers.origin || FRONTEND_ORIGIN;
    const allowedOrigin = isAllowedOrigin(origin) ? origin : FRONTEND_ORIGIN;
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Parse URL
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const path = url.pathname;

    // GET /health - Health check endpoint
    if (req.method === 'GET' && path === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            service: 'tapo-proxy',
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        }));
        return;
    }

    // GET /plugs - List all discovered plugs
    if (req.method === 'GET' && path === '/plugs') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            plugs: discoveredPlugs,
            lastDiscovery,
            count: Object.keys(discoveredPlugs).length
        }));
        return;
    }

    // POST /discover - Trigger plug discovery
    if (req.method === 'POST' && path === '/discover') {
        try {
            console.log('🔍 Manual discovery triggered...');
            const plugs = await discoverAndIdentifyPlugs();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                plugs,
                count: Object.keys(plugs).length,
                discoveredAt: lastDiscovery
            }));
        } catch (error) {
            console.error('Discovery error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
        return;
    }

    // POST /status - Get plug status
    if (req.method === 'POST' && path === '/status') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { plugName } = JSON.parse(body);
                const ip = getPlugIP(plugName);

                if (!ip) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: 'Plug not found',
                        available: Object.keys(discoveredPlugs)
                    }));
                    return;
                }

                const device = await loginDeviceByIp(TAPO_EMAIL, TAPO_PASSWORD, ip);
                const info = await device.getDeviceInfo();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    plugName: plugName,
                    ip: ip,
                    state: info.device_on ? 'on' : 'off',
                    model: info.model,
                    nickname: info.nickname,
                    rssi: info.rssi,
                    onTime: info.on_time
                }));
            } catch (error) {
                console.error('Status error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // POST /on - Turn plug on
    if (req.method === 'POST' && path === '/on') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { plugName } = JSON.parse(body);
                const ip = getPlugIP(plugName);

                if (!ip) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: 'Plug not found',
                        available: Object.keys(discoveredPlugs)
                    }));
                    return;
                }

                console.log(`🔌 Turning ON ${plugName} (${ip})`);
                const device = await loginDeviceByIp(TAPO_EMAIL, TAPO_PASSWORD, ip);
                await device.turnOn();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, state: 'on' }));
            } catch (error) {
                console.error('Turn on error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // POST /off - Turn plug off
    if (req.method === 'POST' && path === '/off') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { plugName } = JSON.parse(body);
                const ip = getPlugIP(plugName);

                if (!ip) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: 'Plug not found',
                        available: Object.keys(discoveredPlugs)
                    }));
                    return;
                }

                console.log(`🔌 Turning OFF ${plugName} (${ip})`);
                const device = await loginDeviceByIp(TAPO_EMAIL, TAPO_PASSWORD, ip);
                await device.turnOff();

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, state: 'off' }));
            } catch (error) {
                console.error('Turn off error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // POST /toggle - Toggle plug state
    if (req.method === 'POST' && path === '/toggle') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { plugName } = JSON.parse(body);
                const ip = getPlugIP(plugName);

                if (!ip) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: 'Plug not found',
                        available: Object.keys(discoveredPlugs)
                    }));
                    return;
                }

                console.log(`🔌 Toggling ${plugName} (${ip})`);
                const device = await loginDeviceByIp(TAPO_EMAIL, TAPO_PASSWORD, ip);
                const info = await device.getDeviceInfo();
                const currentState = info.device_on;

                if (currentState) {
                    await device.turnOff();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, state: 'off' }));
                } else {
                    await device.turnOn();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, state: 'on' }));
                }
            } catch (error) {
                console.error('Toggle error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
        return;
    }

    // 404 for unknown routes
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
});

// Start server with auto-discovery
async function startServer() {
    console.log('🔌 Tapo Smart Plug Proxy starting...\n');

    // Start server FIRST so health checks work immediately
    server.listen(PORT, () => {
        console.log(`🔌 Tapo Proxy running on http://localhost:${PORT}`);
        console.log(`\n📡 Endpoints:`);
        console.log(`   GET  /plugs    - List discovered plugs`);
        console.log(`   POST /discover - Re-scan network for plugs`);
        console.log(`   POST /status   - Get plug status`);
        console.log(`   POST /on       - Turn plug on`);
        console.log(`   POST /off      - Turn plug off`);
        console.log(`   POST /toggle   - Toggle plug state`);
        console.log(`\n🔍 Running plug discovery in background...`);
    });

    // Run discovery AFTER server starts (so health checks work during discovery)
    try {
        await discoverAndIdentifyPlugs();
        console.log(`\n✅ Ready! Open index.html in your browser.`);
    } catch (error) {
        console.error('⚠️  Initial discovery failed:', error.message);
        console.log('   Use POST /discover to retry\n');
    }

    // Set up periodic re-discovery to handle IP address changes
    setInterval(async () => {
        console.log('🔄 Running periodic plug discovery...');
        try {
            await discoverAndIdentifyPlugs();
        } catch (error) {
            console.error('⚠️  Periodic discovery failed:', error.message);
        }
    }, REDISCOVERY_INTERVAL);
    console.log(`⏰ Periodic re-discovery scheduled every ${REDISCOVERY_INTERVAL / 60000} minutes`);
}

startServer();
