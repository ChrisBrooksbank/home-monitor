// Broader network scan to find Tapo devices
// Scans your entire subnet for Tapo smart plugs

const net = require('net');
const http = require('http');
const https = require('https');

// Your network subnet (adjust if different)
const SUBNET = '192.168.68';
const START_IP = 1;
const END_IP = 254;

// Scan in batches to avoid overwhelming the network
const BATCH_SIZE = 20;
const PORT_TIMEOUT = 1000;

/**
 * Check if device responds on Tapo ports
 */
async function checkDevice(ip) {
    // Try port 80 first (Tapo uses HTTP/HTTPS)
    const port80Open = await checkPort(ip, 80);
    const port443Open = await checkPort(ip, 443);

    if (!port80Open && !port443Open) {
        return null; // Not a web device
    }

    // Try to identify as Tapo
    const isTapo = await probeForTapo(ip, port80Open ? 80 : 443);

    if (isTapo || port80Open || port443Open) {
        return {
            ip,
            port80: port80Open,
            port443: port443Open,
            isTapo
        };
    }

    return null;
}

/**
 * Check if port is open
 */
function checkPort(ip, port) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(PORT_TIMEOUT);

        socket.on('connect', () => {
            socket.destroy();
            resolve(true);
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });

        socket.on('error', () => resolve(false));

        socket.connect(port, ip);
    });
}

/**
 * Probe device for Tapo characteristics
 */
function probeForTapo(ip, port) {
    return new Promise((resolve) => {
        const protocol = port === 443 ? https : http;
        const options = {
            hostname: ip,
            port,
            path: '/app',
            method: 'POST',
            timeout: 2000,
            rejectUnauthorized: false,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = protocol.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const isTapo = data.includes('error_code') ||
                              data.toLowerCase().includes('tapo') ||
                              res.headers['server']?.toLowerCase().includes('tapo');
                resolve(isTapo);
            });
        });

        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });

        req.write(JSON.stringify({ method: 'get_device_info' }));
        req.end();
    });
}

/**
 * Scan network in batches
 */
async function scanNetwork() {
    console.log(`\n🔍 Scanning ${SUBNET}.${START_IP}-${END_IP} for Tapo devices...`);
    console.log('This may take a few minutes...\n');

    const allDevices = [];
    let scanned = 0;
    const total = END_IP - START_IP + 1;

    for (let i = START_IP; i <= END_IP; i += BATCH_SIZE) {
        const batch = [];
        const end = Math.min(i + BATCH_SIZE - 1, END_IP);

        // Create batch of promises
        for (let j = i; j <= end; j++) {
            const ip = `${SUBNET}.${j}`;
            batch.push(checkDevice(ip));
        }

        // Wait for batch to complete
        const results = await Promise.all(batch);

        // Filter and collect results
        results.forEach(result => {
            if (result) {
                allDevices.push(result);
                const tapoIndicator = result.isTapo ? '🎯 TAPO' : '📡';
                console.log(`${tapoIndicator} Found device at ${result.ip} (HTTP:${result.port80 ? '✓' : '✗'} HTTPS:${result.port443 ? '✓' : '✗'})`);
            }
        });

        scanned += batch.length;
        process.stdout.write(`\rProgress: ${scanned}/${total} (${Math.round(scanned/total*100)}%)`);
    }

    console.log('\n');
    return allDevices;
}

/**
 * Main function
 */
async function main() {
    console.log('═'.repeat(60));
    console.log('TAPO DEVICE FINDER');
    console.log('═'.repeat(60));

    const devices = await scanNetwork();

    console.log('═'.repeat(60));
    console.log('SCAN RESULTS');
    console.log('═'.repeat(60));

    const tapoDevices = devices.filter(d => d.isTapo);
    const otherDevices = devices.filter(d => !d.isTapo);

    if (tapoDevices.length > 0) {
        console.log('\n✅ TAPO DEVICES FOUND:');
        tapoDevices.forEach(d => {
            console.log(`   ${d.ip}`);
        });
        console.log('\n📝 Copy these IPs into tapo-control.js PLUGS configuration');
    } else {
        console.log('\n⚠️  No Tapo devices detected');
        console.log('\nPossible reasons:');
        console.log('   • Tapo plugs not set up yet');
        console.log('   • Plugs are powered off');
        console.log('   • Plugs are on a different network/subnet');
        console.log('   • Plugs haven\'t been added to Tapo app yet');
    }

    if (otherDevices.length > 0) {
        console.log(`\n📡 Other web-enabled devices found: ${otherDevices.length}`);
        console.log('   (These might be routers, NAS, cameras, etc.)');
    }

    console.log('\n💡 TIP: Open your Tapo app to see device IPs:');
    console.log('   Tapo App → Select Device → Settings (gear) → Device Info\n');
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Error:', err);
            process.exit(1);
        });
}

module.exports = { scanNetwork, checkDevice };
