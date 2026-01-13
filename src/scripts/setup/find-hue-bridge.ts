#!/usr/bin/env npx tsx
/**
 * Scan network for Philips Hue Bridge
 * Run with: npx tsx src/scripts/setup/find-hue-bridge.ts
 *
 * Scans the local network (192.168.68.x and 10.5.0.x) to find Hue Bridges
 * by querying the /api/config endpoint on each IP.
 */

import http, { type IncomingMessage } from 'http';

// =============================================================================
// TYPES
// =============================================================================

interface HueBridgeInfo {
    ip: string;
    name: string;
    model: string;
    version: string;
    mac: string;
}

interface HueBridgeConfigResponse {
    modelid?: string;
    name?: string;
    apiversion?: string;
    mac?: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const BASE_NETWORK = '192.168.68.';
const ALT_NETWORK = '10.5.0.';
const START_IP = 1;
const END_IP = 254;
const BATCH_SIZE = 20;
const TIMEOUT_MS = 1000;

// =============================================================================
// STATE
// =============================================================================

const foundBridges: HueBridgeInfo[] = [];
let scannedCount = 0;
const totalToScan = END_IP - START_IP + 1;

// =============================================================================
// SCANNER
// =============================================================================

/**
 * Check if an IP is a Hue Bridge
 */
function checkIP(ip: string): Promise<void> {
    return new Promise((resolve) => {
        const req = http.get(`http://${ip}/api/config`, { timeout: TIMEOUT_MS }, (res: IncomingMessage) => {
            let data = '';
            res.on('data', (chunk: Buffer) => (data += chunk));
            res.on('end', () => {
                try {
                    const config = JSON.parse(data) as HueBridgeConfigResponse;
                    if (config.modelid && config.modelid.toLowerCase().includes('bsb')) {
                        // This looks like a Hue Bridge!
                        foundBridges.push({
                            ip: ip,
                            name: config.name || 'Unknown',
                            model: config.modelid,
                            version: config.apiversion || 'Unknown',
                            mac: config.mac || 'Unknown',
                        });
                        console.log(`[OK] Found Hue Bridge at ${ip}`);
                        console.log(`  Name: ${config.name}`);
                        console.log(`  Model: ${config.modelid}`);
                        console.log(`  MAC: ${config.mac}`);
                        console.log('');
                    }
                } catch {
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

        req.setTimeout(TIMEOUT_MS);
    });
}

/**
 * Scan a network subnet for Hue Bridges
 */
async function scanNetwork(baseNetwork: string, showProgress = true): Promise<void> {
    const promises: Promise<void>[] = [];

    // Scan in batches to avoid overwhelming the network
    for (let i = START_IP; i <= END_IP; i++) {
        const ip = baseNetwork + i;
        promises.push(
            checkIP(ip).then(() => {
                scannedCount++;
                if (showProgress && scannedCount % 50 === 0) {
                    process.stdout.write(`Scanned ${scannedCount}/${totalToScan} IPs...\r`);
                }
            })
        );

        // Wait every BATCH_SIZE requests
        if (promises.length >= BATCH_SIZE) {
            await Promise.all(promises);
            promises.length = 0;
        }
    }

    // Wait for remaining requests
    await Promise.all(promises);
}

/**
 * Print scan results
 */
function printResults(): void {
    console.log(`\nScanned ${scannedCount} IPs.                    `);
    console.log('\n=== Scan Complete ===\n');

    if (foundBridges.length === 0) {
        console.log('No Hue Bridges found.');
        console.log('\nTroubleshooting:');
        console.log('1. Make sure the Hue Bridge is powered on');
        console.log('2. Check if your Bridge is on a different network');
        console.log("3. Check your router's connected devices list");
    } else {
        console.log(`Found ${foundBridges.length} Hue Bridge(s):`);
        foundBridges.forEach((bridge) => {
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

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
    console.log('\n=== Scanning for Hue Bridge ===\n');
    console.log(`Scanning ${BASE_NETWORK}x network...\n`);

    await scanNetwork(BASE_NETWORK);

    if (foundBridges.length === 0) {
        console.log(`\nAlso checking ${ALT_NETWORK}x network...\n`);
        scannedCount = 0;
        await scanNetwork(ALT_NETWORK, false);

        if (foundBridges.length > 0) {
            console.log(`\nFound ${foundBridges.length} Hue Bridge(s) on ${ALT_NETWORK}x network!`);
            foundBridges.forEach((bridge) => {
                console.log(`\n  IP: ${bridge.ip}`);
                console.log(`  Name: ${bridge.name}`);
            });
            console.log('\nUpdate config.js with the correct IP address:');
            console.log(`  BRIDGE_IP: "${foundBridges[0].ip}",`);
        }
    }

    printResults();
}

main().catch(console.error);
