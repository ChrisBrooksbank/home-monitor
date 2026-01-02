// Tapo Smart Plug Proxy Server
// Allows web interface to control Tapo devices
const http = require('http');
const { loginDeviceByIp } = require('tp-link-tapo-connect');

const PORT = 3001;

// Load configuration from tapo-control.js
const tapoControl = require('./tapo-control.js');
const TAPO_EMAIL = process.env.TAPO_EMAIL || 'chrisbrooksbank@gmail.com';
const TAPO_PASSWORD = process.env.TAPO_PASSWORD || 'Monty@28';
const PLUGS = tapoControl.PLUGS;

const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
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

    // GET /plugs - List all configured plugs
    if (req.method === 'GET' && path === '/plugs') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ plugs: PLUGS }));
        return;
    }

    // POST /status - Get plug status
    if (req.method === 'POST' && path === '/status') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', async () => {
            try {
                const { plugName } = JSON.parse(body);
                const ip = PLUGS[plugName];

                if (!ip) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Plug not found' }));
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
                const ip = PLUGS[plugName];

                if (!ip) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Plug not found' }));
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
                const ip = PLUGS[plugName];

                if (!ip) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Plug not found' }));
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
                const ip = PLUGS[plugName];

                if (!ip) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Plug not found' }));
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

server.listen(PORT, () => {
    console.log(`🔌 Tapo Smart Plug Proxy running on http://localhost:${PORT}`);
    console.log(`   Configured plugs:`);
    for (const [name, ip] of Object.entries(PLUGS)) {
        console.log(`   - ${name}: ${ip}`);
    }
    console.log(`\n📡 Endpoints:`);
    console.log(`   GET  /plugs  - List all plugs`);
    console.log(`   POST /status - Get plug status`);
    console.log(`   POST /on     - Turn plug on`);
    console.log(`   POST /off    - Turn plug off`);
    console.log(`   POST /toggle - Toggle plug state`);
    console.log(`\nNow open index.html in your browser to use the Tapo controls.`);
});
