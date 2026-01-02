// Sonos Speaker Network Scanner
const http = require('http');
const dgram = require('dgram');

console.log('🔍 Scanning for Sonos speakers on the network...\n');

// Method 1: SSDP Discovery (UPnP)
function ssdpDiscover() {
    return new Promise((resolve) => {
        const socket = dgram.createSocket('udp4');
        const foundDevices = new Set();

        const SSDP_PORT = 1900;
        const SSDP_ADDRESS = '239.255.255.250';
        const SEARCH_TARGET = 'urn:schemas-upnp-org:device:ZonePlayer:1';

        const message = Buffer.from(
            'M-SEARCH * HTTP/1.1\r\n' +
            `HOST: ${SSDP_ADDRESS}:${SSDP_PORT}\r\n` +
            'MAN: "ssdp:discover"\r\n' +
            'MX: 3\r\n' +
            `ST: ${SEARCH_TARGET}\r\n` +
            '\r\n'
        );

        socket.on('message', (msg, rinfo) => {
            const response = msg.toString();
            if (response.includes('Sonos') || response.includes('ZonePlayer')) {
                const ipMatch = response.match(/LOCATION:.*?http:\/\/([^:\/]+)/i);
                if (ipMatch && !foundDevices.has(ipMatch[1])) {
                    foundDevices.add(ipMatch[1]);
                    console.log(`✓ Found Sonos device via SSDP: ${ipMatch[1]}`);
                    checkSonosDevice(ipMatch[1]);
                }
            }
        });

        socket.bind(() => {
            socket.addMembership(SSDP_ADDRESS);
            socket.send(message, 0, message.length, SSDP_PORT, SSDP_ADDRESS, (err) => {
                if (err) console.error('SSDP send error:', err);
            });
        });

        setTimeout(() => {
            socket.close();
            resolve(foundDevices);
        }, 5000);
    });
}

// Method 2: Direct HTTP scan on common Sonos port (1400)
function scanNetwork() {
    const subnet = '192.168.68'; // Adjust if needed
    const promises = [];

    for (let i = 1; i < 255; i++) {
        const ip = `${subnet}.${i}`;
        promises.push(checkSonosDevice(ip));
    }

    return Promise.all(promises);
}

function checkSonosDevice(ip) {
    return new Promise((resolve) => {
        const options = {
            hostname: ip,
            port: 1400,
            path: '/xml/device_description.xml',
            method: 'GET',
            timeout: 1000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (data.includes('Sonos') || data.includes('ZonePlayer')) {
                    console.log(`\n📻 Sonos Speaker Found!`);
                    console.log(`   IP Address: ${ip}`);
                    console.log(`   Port: 1400`);

                    // Extract device info
                    const nameMatch = data.match(/<roomName>([^<]+)<\/roomName>/);
                    const modelMatch = data.match(/<modelName>([^<]+)<\/modelName>/);
                    const serialMatch = data.match(/<serialNum>([^<]+)<\/serialNum>/);

                    if (nameMatch) console.log(`   Room: ${nameMatch[1]}`);
                    if (modelMatch) console.log(`   Model: ${modelMatch[1]}`);
                    if (serialMatch) console.log(`   Serial: ${serialMatch[1]}`);

                    console.log(`   API: http://${ip}:1400/`);
                }
                resolve();
            });
        });

        req.on('error', () => resolve());
        req.on('timeout', () => {
            req.destroy();
            resolve();
        });

        req.end();
    });
}

// Run both discovery methods
console.log('Method 1: SSDP Discovery (UPnP)...');
ssdpDiscover().then(() => {
    console.log('\nMethod 2: Network scan on port 1400...');
    return scanNetwork();
}).then(() => {
    console.log('\n✓ Scan complete!\n');
});
