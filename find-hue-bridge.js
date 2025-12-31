// Scan network for Philips Hue Bridge
const http = require('http');

console.log('\n=== Scanning for Hue Bridge ===\n');
console.log('Scanning 192.168.68.x network...\n');

// Get the base network from current IP (192.168.68.x)
const baseNetwork = '192.168.68.';
const startIP = 1;
const endIP = 254;

let foundBridges = [];
let scannedCount = 0;
const totalToScan = endIP - startIP + 1;

function checkIP(ip) {
    return new Promise((resolve) => {
        const req = http.get(`http://${ip}/api/config`, { timeout: 1000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const config = JSON.parse(data);
                    if (config.modelid && config.modelid.toLowerCase().includes('bsb')) {
                        // This looks like a Hue Bridge!
                        foundBridges.push({
                            ip: ip,
                            name: config.name,
                            model: config.modelid,
                            version: config.apiversion,
                            mac: config.mac
                        });
                        console.log(`✓ Found Hue Bridge at ${ip}`);
                        console.log(`  Name: ${config.name}`);
                        console.log(`  Model: ${config.modelid}`);
                        console.log(`  MAC: ${config.mac}`);
                        console.log('');
                    }
                } catch (err) {
                    // Not a valid Hue response
                }
                resolve();
            });
        });

        req.on('error', () => resolve());
        req.on('timeout', () => {
            req.destroy();
            resolve();
        });

        req.setTimeout(1000);
    });
}

async function scanNetwork() {
    const promises = [];

    // Scan in batches of 20 to avoid overwhelming the network
    for (let i = startIP; i <= endIP; i++) {
        const ip = baseNetwork + i;
        promises.push(
            checkIP(ip).then(() => {
                scannedCount++;
                if (scannedCount % 50 === 0) {
                    process.stdout.write(`Scanned ${scannedCount}/${totalToScan} IPs...\r`);
                }
            })
        );

        // Wait every 20 requests
        if (promises.length >= 20) {
            await Promise.all(promises);
            promises.length = 0;
        }
    }

    // Wait for remaining requests
    await Promise.all(promises);

    console.log(`\nScanned ${scannedCount}/${totalToScan} IPs.                    `);
    console.log('\n=== Scan Complete ===\n');

    if (foundBridges.length === 0) {
        console.log('No Hue Bridges found on 192.168.68.x network.');
        console.log('\nTroubleshooting:');
        console.log('1. Make sure the Hue Bridge is powered on');
        console.log('2. Check if your Bridge is on a different network (10.5.0.x?)');
        console.log('3. Check your router\'s connected devices list');
    } else {
        console.log(`Found ${foundBridges.length} Hue Bridge(s):`);
        foundBridges.forEach(bridge => {
            console.log(`\n  IP: ${bridge.ip}`);
            console.log(`  Name: ${bridge.name}`);
            console.log(`  Model: ${bridge.model}`);
            console.log(`  MAC: ${bridge.mac}`);
        });
        console.log('\nUpdate config.js with the correct IP address:');
        console.log(`  BRIDGE_IP: "${foundBridges[0].ip}",`);
    }
    console.log('');
}

// Also check the 10.5.0.x network since that's another local IP
async function checkOtherNetwork() {
    console.log('Also checking 10.5.0.x network...\n');
    const promises = [];
    for (let i = 1; i <= 254; i++) {
        const ip = '10.5.0.' + i;
        promises.push(checkIP(ip));
        if (promises.length >= 20) {
            await Promise.all(promises);
            promises.length = 0;
        }
    }
    await Promise.all(promises);
}

(async () => {
    await scanNetwork();

    if (foundBridges.length === 0) {
        await checkOtherNetwork();

        if (foundBridges.length > 0) {
            console.log(`\nFound ${foundBridges.length} Hue Bridge(s) on 10.5.0.x network!`);
            foundBridges.forEach(bridge => {
                console.log(`\n  IP: ${bridge.ip}`);
                console.log(`  Name: ${bridge.name}`);
            });
            console.log('\nUpdate config.js with the correct IP address:');
            console.log(`  BRIDGE_IP: "${foundBridges[0].ip}",`);
        }
    }
})();
