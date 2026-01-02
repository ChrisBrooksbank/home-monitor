// Detect Tapo P105 Smart Plugs on Your Network
// This script tries to identify which devices are Tapo plugs

const http = require('http');
const https = require('https');
const net = require('net');

// Devices to check (from your network scan)
const DEVICES_TO_CHECK = [
    { ip: '192.168.68.60', mac: '48-a6-b8-3e-de-8e', vendor: 'Espressif (ESP32)' },
    { ip: '192.168.68.61', mac: '5c-aa-fd-b9-1a-fa', vendor: 'Shenzhen Bilian' },
    { ip: '192.168.68.62', mac: '64-95-6c-94-85-d3', vendor: 'Unknown' },
    { ip: '192.168.68.63', mac: '3c-6d-66-01-cb-fc', vendor: 'Unknown' }
];

// Tapo devices typically respond on these characteristics
const TAPO_INDICATORS = {
    ports: [80, 443],  // Tapo uses HTTP/HTTPS
    paths: ['/app', '/app/request', '/'],
    userAgent: 'Tapo'
};

/**
 * Check if a port is open
 */
async function checkPort(ip, port, timeout = 2000) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(timeout);

        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });

        socket.on('error', () => {
            resolve(false);
        });

        socket.connect(port, ip);
    });
}

/**
 * Try HTTP request to detect Tapo device
 */
async function checkHTTP(ip, port) {
    return new Promise((resolve) => {
        const protocol = port === 443 ? https : http;
        const options = {
            hostname: ip,
            port: port,
            path: '/app',
            method: 'POST',
            timeout: 3000,
            rejectUnauthorized: false,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = protocol.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                // Tapo devices respond with JSON errors if auth is missing
                const isTapo = data.includes('error_code') ||
                              data.includes('tapo') ||
                              res.headers['server']?.toLowerCase().includes('tapo');

                resolve({
                    responding: true,
                    statusCode: res.statusCode,
                    isTapo: isTapo,
                    response: data.substring(0, 200),
                    headers: res.headers
                });
            });
        });

        req.on('error', () => {
            resolve({ responding: false });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ responding: false });
        });

        // Send a test request
        req.write(JSON.stringify({ method: 'get_device_info' }));
        req.end();
    });
}

/**
 * Identify device type
 */
async function identifyDevice(device) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Checking: ${device.ip}`);
    console.log(`MAC: ${device.mac} (${device.vendor})`);
    console.log(`${'='.repeat(60)}`);

    const results = {
        ip: device.ip,
        mac: device.mac,
        vendor: device.vendor,
        openPorts: [],
        isTapo: false,
        deviceType: 'Unknown'
    };

    // Check ports
    for (const port of [80, 443, 8008, 9999]) {
        const isOpen = await checkPort(device.ip, port);
        if (isOpen) {
            console.log(`✓ Port ${port} is OPEN`);
            results.openPorts.push(port);
        }
    }

    if (results.openPorts.length === 0) {
        console.log('✗ No common ports responding - device may be offline');
        return results;
    }

    // Check for Tapo on HTTP/HTTPS
    for (const port of [80, 443]) {
        if (results.openPorts.includes(port)) {
            console.log(`\nTesting ${port === 443 ? 'HTTPS' : 'HTTP'} on port ${port}...`);
            const httpResult = await checkHTTP(device.ip, port);

            if (httpResult.responding) {
                console.log(`  Response code: ${httpResult.statusCode}`);
                console.log(`  Server header: ${httpResult.headers?.server || 'None'}`);

                if (httpResult.isTapo) {
                    console.log(`  🎯 TAPO DEVICE DETECTED!`);
                    results.isTapo = true;
                    results.deviceType = 'Tapo Smart Plug (likely P105)';
                }

                if (httpResult.response) {
                    console.log(`  Response sample: ${httpResult.response}`);
                }
            }
        }
    }

    // Check for Google Cast (port 8008) - rules out SHIELD/Chromecast
    if (results.openPorts.includes(8008)) {
        console.log('\n⚠️  Port 8008 open - This might be a Chromecast/SHIELD/Sonos device');
        results.deviceType = 'Google Cast Device (not a Tapo plug)';
    }

    // Make educated guess based on MAC vendor
    if (!results.isTapo && device.vendor.includes('Espressif')) {
        console.log('\n💡 Espressif chip detected - could be Tapo/smart device (try Tapo app)');
        results.deviceType = 'Possible Tapo or ESP-based smart device';
    }

    if (!results.isTapo && device.vendor.includes('Bilian')) {
        console.log('\n💡 Shenzhen Bilian - commonly used in smart plugs');
        results.deviceType = 'Possible smart plug (non-Tapo)';
    }

    console.log(`\n📋 Conclusion: ${results.deviceType}`);

    return results;
}

/**
 * Main detection routine
 */
async function detectAllDevices() {
    console.log('\n🔍 TAPO P105 DETECTION TOOL');
    console.log('=' .repeat(60));
    console.log('Scanning devices for Tapo smart plugs...\n');

    const allResults = [];

    for (const device of DEVICES_TO_CHECK) {
        const result = await identifyDevice(device);
        allResults.push(result);
        await new Promise(resolve => setTimeout(resolve, 500)); // Delay between checks
    }

    // Summary
    console.log('\n\n' + '='.repeat(60));
    console.log('DETECTION SUMMARY');
    console.log('='.repeat(60));

    const tapoDevices = allResults.filter(r => r.isTapo);
    const possibleTapo = allResults.filter(r =>
        !r.isTapo && r.deviceType.toLowerCase().includes('possible')
    );

    if (tapoDevices.length > 0) {
        console.log('\n✅ CONFIRMED TAPO DEVICES:');
        tapoDevices.forEach(d => {
            console.log(`   ${d.ip} - ${d.deviceType}`);
        });
    } else {
        console.log('\n⚠️  No confirmed Tapo devices detected via API');
    }

    if (possibleTapo.length > 0) {
        console.log('\n🤔 POSSIBLE TAPO/SMART DEVICES:');
        possibleTapo.forEach(d => {
            console.log(`   ${d.ip} - ${d.deviceType}`);
            console.log(`      MAC: ${d.mac} (${d.vendor})`);
        });
        console.log('\n   💡 Check these devices in your Tapo app to confirm');
    }

    console.log('\n📝 NEXT STEPS:');
    console.log('   1. Open your Tapo app');
    console.log('   2. Check each device\'s IP address in device settings');
    console.log('   3. Update tapo-control.js with the correct IPs');
    console.log('   4. Consider assigning static IPs to your Tapo plugs in your router\n');

    return allResults;
}

// Run detection
if (require.main === module) {
    detectAllDevices()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Error during detection:', err);
            process.exit(1);
        });
}

module.exports = { detectAllDevices, identifyDevice };
