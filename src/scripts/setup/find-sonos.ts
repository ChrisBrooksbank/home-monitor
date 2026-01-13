#!/usr/bin/env npx tsx
/**
 * Sonos Speaker Network Scanner
 * Run with: npx tsx src/scripts/setup/find-sonos.ts
 *
 * Uses two discovery methods:
 * 1. SSDP Discovery (UPnP multicast)
 * 2. Direct HTTP scan on port 1400
 */

import http, { type IncomingMessage } from 'http';
import dgram, { type Socket } from 'dgram';

// =============================================================================
// TYPES
// =============================================================================

interface SonosDeviceInfo {
    ip: string;
    room?: string;
    model?: string;
    serial?: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const SUBNET = '192.168.68';
const SONOS_PORT = 1400;
const SSDP_PORT = 1900;
const SSDP_ADDRESS = '239.255.255.250';
const SEARCH_TARGET = 'urn:schemas-upnp-org:device:ZonePlayer:1';
const TIMEOUT_MS = 1000;
const SSDP_TIMEOUT_MS = 5000;

// =============================================================================
// SSDP DISCOVERY
// =============================================================================

/**
 * Discover Sonos devices using SSDP multicast
 */
function ssdpDiscover(): Promise<Set<string>> {
    return new Promise((resolve) => {
        const socket: Socket = dgram.createSocket('udp4');
        const foundDevices = new Set<string>();

        const message = Buffer.from(
            'M-SEARCH * HTTP/1.1\r\n' +
                `HOST: ${SSDP_ADDRESS}:${SSDP_PORT}\r\n` +
                'MAN: "ssdp:discover"\r\n' +
                'MX: 3\r\n' +
                `ST: ${SEARCH_TARGET}\r\n` +
                '\r\n'
        );

        socket.on('message', (msg: Buffer) => {
            const response = msg.toString();
            if (response.includes('Sonos') || response.includes('ZonePlayer')) {
                const ipMatch = response.match(/LOCATION:.*?http:\/\/([^:/]+)/i);
                if (ipMatch && ipMatch[1] && !foundDevices.has(ipMatch[1])) {
                    foundDevices.add(ipMatch[1]);
                    console.log(`[OK] Found Sonos device via SSDP: ${ipMatch[1]}`);
                    void checkSonosDevice(ipMatch[1]);
                }
            }
        });

        socket.on('error', (err) => {
            console.error('SSDP socket error:', err.message);
        });

        socket.bind(() => {
            try {
                socket.addMembership(SSDP_ADDRESS);
                socket.send(message, 0, message.length, SSDP_PORT, SSDP_ADDRESS, (err) => {
                    if (err) console.error('SSDP send error:', err);
                });
            } catch (err) {
                const error = err as Error;
                console.error('SSDP membership error:', error.message);
            }
        });

        setTimeout(() => {
            socket.close();
            resolve(foundDevices);
        }, SSDP_TIMEOUT_MS);
    });
}

// =============================================================================
// HTTP SCANNING
// =============================================================================

/**
 * Check if an IP is a Sonos device by querying its device description
 */
function checkSonosDevice(ip: string): Promise<SonosDeviceInfo | null> {
    return new Promise((resolve) => {
        const options = {
            hostname: ip,
            port: SONOS_PORT,
            path: '/xml/device_description.xml',
            method: 'GET',
            timeout: TIMEOUT_MS,
        };

        const req = http.request(options, (res: IncomingMessage) => {
            let data = '';
            res.on('data', (chunk: Buffer) => (data += chunk));
            res.on('end', () => {
                if (data.includes('Sonos') || data.includes('ZonePlayer')) {
                    console.log(`\n[SPEAKER] Sonos Speaker Found!`);
                    console.log(`   IP Address: ${ip}`);
                    console.log(`   Port: ${SONOS_PORT}`);

                    // Extract device info
                    const nameMatch = data.match(/<roomName>([^<]+)<\/roomName>/);
                    const modelMatch = data.match(/<modelName>([^<]+)<\/modelName>/);
                    const serialMatch = data.match(/<serialNum>([^<]+)<\/serialNum>/);

                    const info: SonosDeviceInfo = { ip };

                    if (nameMatch?.[1]) {
                        info.room = nameMatch[1];
                        console.log(`   Room: ${nameMatch[1]}`);
                    }
                    if (modelMatch?.[1]) {
                        info.model = modelMatch[1];
                        console.log(`   Model: ${modelMatch[1]}`);
                    }
                    if (serialMatch?.[1]) {
                        info.serial = serialMatch[1];
                        console.log(`   Serial: ${serialMatch[1]}`);
                    }

                    console.log(`   API: http://${ip}:${SONOS_PORT}/`);
                    resolve(info);
                } else {
                    resolve(null);
                }
            });
        });

        req.on('error', () => resolve(null));
        req.on('timeout', () => {
            req.destroy();
            resolve(null);
        });

        req.end();
    });
}

/**
 * Scan network for Sonos devices on port 1400
 */
async function scanNetwork(): Promise<SonosDeviceInfo[]> {
    const devices: SonosDeviceInfo[] = [];
    const promises: Promise<SonosDeviceInfo | null>[] = [];

    for (let i = 1; i < 255; i++) {
        const ip = `${SUBNET}.${i}`;
        promises.push(checkSonosDevice(ip));
    }

    const results = await Promise.all(promises);
    results.forEach((result) => {
        if (result) {
            devices.push(result);
        }
    });

    return devices;
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
    console.log('[SCAN] Scanning for Sonos speakers on the network...\n');

    console.log('Method 1: SSDP Discovery (UPnP)...');
    await ssdpDiscover();

    console.log('\nMethod 2: Network scan on port 1400...');
    await scanNetwork();

    console.log('\n[OK] Scan complete!\n');
}

main().catch(console.error);
