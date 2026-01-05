// Hue Bridge Auto-Discovery
// Finds Philips Hue bridges by probing /api/config endpoint

const http = require('http');

const BASE_IP = process.env.HUE_BASE_IP || '192.168.68';
const SCAN_START = parseInt(process.env.HUE_SCAN_START || '50');
const SCAN_END = parseInt(process.env.HUE_SCAN_END || '90');

/**
 * Probe a single IP for Hue Bridge API
 */
function probeHue(ip, timeout = 2000) {
    return new Promise((resolve) => {
        const req = http.request({
            hostname: ip,
            port: 80,
            path: '/api/config',
            method: 'GET',
            timeout: timeout
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const config = JSON.parse(data);
                    // Hue bridges have specific fields in /api/config
                    if (config.name && config.bridgeid && config.modelid) {
                        resolve({
                            ip,
                            isHue: true,
                            name: config.name,
                            model: config.modelid,
                            bridgeId: config.bridgeid,
                            apiVersion: config.apiversion,
                            swVersion: config.swversion
                        });
                    } else {
                        resolve({ ip, isHue: false });
                    }
                } catch {
                    resolve({ ip, isHue: false });
                }
            });
        });

        req.on('error', () => resolve({ ip, isHue: false }));
        req.on('timeout', () => { req.destroy(); resolve({ ip, isHue: false }); });
        req.end();
    });
}

/**
 * Scan network for Hue bridges
 */
async function scanForBridges(baseIp, start, end, batchSize = 10) {
    console.log(`🔍 Scanning ${baseIp}.${start}-${end} for Hue bridges...`);
    const results = [];

    for (let i = start; i <= end; i += batchSize) {
        const batch = [];
        for (let j = i; j < Math.min(i + batchSize, end + 1); j++) {
            batch.push(probeHue(`${baseIp}.${j}`));
        }
        const batchResults = await Promise.all(batch);
        results.push(...batchResults.filter(r => r.isHue));
    }

    return results;
}

/**
 * Discover Hue bridges
 */
async function discoverBridges() {
    const startTime = Date.now();

    const bridges = await scanForBridges(BASE_IP, SCAN_START, SCAN_END);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Discovery complete in ${elapsed}s - found ${bridges.length} bridge(s)\n`);

    for (const bridge of bridges) {
        console.log(`   ✓ ${bridge.name} (${bridge.model}) @ ${bridge.ip}`);
        console.log(`     Bridge ID: ${bridge.bridgeId}`);
        console.log(`     API: ${bridge.apiVersion}, SW: ${bridge.swVersion}`);
    }

    return bridges;
}

// Run if called directly
if (require.main === module) {
    discoverBridges().then(bridges => {
        console.log('\nJSON output:');
        console.log(JSON.stringify(bridges, null, 2));
    });
}

module.exports = { discoverBridges, probeHue };
