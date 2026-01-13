#!/usr/bin/env npx tsx
/**
 * Tapo Smart Plug Network Scanner
 * Run with: npx tsx src/scripts/setup/find-tapo.ts
 *
 * Scans the local network for TP-Link Tapo smart plugs by:
 * 1. Checking for open HTTP/HTTPS ports (80, 443)
 * 2. Probing the /app endpoint for Tapo-specific responses
 */

import net, { type Socket } from 'net';
import http, { type IncomingMessage } from 'http';
import https from 'https';

// =============================================================================
// TYPES
// =============================================================================

interface DeviceResult {
    ip: string;
    port80: boolean;
    port443: boolean;
    isTapo: boolean;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const SUBNET = '192.168.68';
const START_IP = 1;
const END_IP = 254;
const BATCH_SIZE = 20;
const PORT_TIMEOUT = 1000;
const PROBE_TIMEOUT = 2000;

// =============================================================================
// PORT SCANNING
// =============================================================================

/**
 * Check if a port is open on an IP
 */
function checkPort(ip: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const socket: Socket = new net.Socket();
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

// =============================================================================
// TAPO DETECTION
// =============================================================================

/**
 * Probe device for Tapo characteristics
 */
function probeForTapo(ip: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const protocol = port === 443 ? https : http;
        const options = {
            hostname: ip,
            port,
            path: '/app',
            method: 'POST',
            timeout: PROBE_TIMEOUT,
            rejectUnauthorized: false,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const req = protocol.request(options, (res: IncomingMessage) => {
            let data = '';
            res.on('data', (chunk: Buffer) => (data += chunk));
            res.on('end', () => {
                const serverHeader = res.headers['server'];
                const serverString = Array.isArray(serverHeader) ? serverHeader[0] : serverHeader;
                const isTapo =
                    data.includes('error_code') ||
                    data.toLowerCase().includes('tapo') ||
                    (serverString?.toLowerCase().includes('tapo') ?? false);
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
 * Check if device responds on Tapo ports
 */
async function checkDevice(ip: string): Promise<DeviceResult | null> {
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
            isTapo,
        };
    }

    return null;
}

// =============================================================================
// NETWORK SCANNING
// =============================================================================

/**
 * Scan network in batches
 */
async function scanNetwork(): Promise<DeviceResult[]> {
    console.log(`\n[SCAN] Scanning ${SUBNET}.${START_IP}-${END_IP} for Tapo devices...`);
    console.log('This may take a few minutes...\n');

    const allDevices: DeviceResult[] = [];
    let scanned = 0;
    const total = END_IP - START_IP + 1;

    for (let i = START_IP; i <= END_IP; i += BATCH_SIZE) {
        const batch: Promise<DeviceResult | null>[] = [];
        const end = Math.min(i + BATCH_SIZE - 1, END_IP);

        // Create batch of promises
        for (let j = i; j <= end; j++) {
            const ip = `${SUBNET}.${j}`;
            batch.push(checkDevice(ip));
        }

        // Wait for batch to complete
        const results = await Promise.all(batch);

        // Filter and collect results
        results.forEach((result) => {
            if (result) {
                allDevices.push(result);
                const tapoIndicator = result.isTapo ? '[TAPO]' : '[DEVICE]';
                console.log(
                    `${tapoIndicator} Found device at ${result.ip} (HTTP:${result.port80 ? 'OK' : 'NO'} HTTPS:${result.port443 ? 'OK' : 'NO'})`
                );
            }
        });

        scanned += batch.length;
        process.stdout.write(`\rProgress: ${scanned}/${total} (${Math.round((scanned / total) * 100)}%)`);
    }

    console.log('\n');
    return allDevices;
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
    console.log('='.repeat(60));
    console.log('TAPO DEVICE FINDER');
    console.log('='.repeat(60));

    const devices = await scanNetwork();

    console.log('='.repeat(60));
    console.log('SCAN RESULTS');
    console.log('='.repeat(60));

    const tapoDevices = devices.filter((d) => d.isTapo);
    const otherDevices = devices.filter((d) => !d.isTapo);

    if (tapoDevices.length > 0) {
        console.log('\n[OK] TAPO DEVICES FOUND:');
        tapoDevices.forEach((d) => {
            console.log(`   ${d.ip}`);
        });
        console.log('\n[INFO] Copy these IPs into tapo-control.js PLUGS configuration');
    } else {
        console.log('\n[WARN] No Tapo devices detected');
        console.log('\nPossible reasons:');
        console.log('   - Tapo plugs not set up yet');
        console.log('   - Plugs are powered off');
        console.log('   - Plugs are on a different network/subnet');
        console.log("   - Plugs haven't been added to Tapo app yet");
    }

    if (otherDevices.length > 0) {
        console.log(`\n[INFO] Other web-enabled devices found: ${otherDevices.length}`);
        console.log('   (These might be routers, NAS, cameras, etc.)');
    }

    console.log('\n[TIP] Open your Tapo app to see device IPs:');
    console.log('   Tapo App -> Select Device -> Settings (gear) -> Device Info\n');
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('Error:', err);
        process.exit(1);
    });
