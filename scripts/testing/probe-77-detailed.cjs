// Detailed probe of 192.168.68.77
const http = require('http');
const net = require('net');

const TARGET_IP = '192.168.68.77';

async function httpGet(path) {
    return new Promise((resolve) => {
        const options = {
            hostname: TARGET_IP,
            port: 80,
            path: path,
            method: 'GET',
            timeout: 3000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });

        req.on('error', (err) => resolve({ error: err.message }));
        req.on('timeout', () => {
            req.destroy();
            resolve({ error: 'timeout' });
        });

        req.end();
    });
}

async function httpPost(path, body) {
    return new Promise((resolve) => {
        const options = {
            hostname: TARGET_IP,
            port: 80,
            path: path,
            method: 'POST',
            timeout: 3000,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });

        req.on('error', (err) => resolve({ error: err.message }));
        req.on('timeout', () => {
            req.destroy();
            resolve({ error: 'timeout' });
        });

        req.write(body);
        req.end();
    });
}

async function main() {
    console.log('═'.repeat(70));
    console.log(`DETAILED PROBE OF ${TARGET_IP}`);
    console.log('═'.repeat(70));

    // Try various paths
    const paths = [
        '/',
        '/app',
        '/app/request',
        '/api',
        '/api/v1',
        '/status',
        '/info',
        '/device_info',
        '/cgi-bin/status'
    ];

    console.log('\n🔍 Probing common HTTP paths...\n');

    for (const path of paths) {
        const result = await httpGet(path);
        if (result.error) {
            console.log(`   ${path.padEnd(20)} - Error: ${result.error}`);
        } else {
            console.log(`   ${path.padEnd(20)} - ${result.statusCode} (${result.body.length} bytes)`);
            if (result.headers.server) {
                console.log(`      Server: ${result.headers.server}`);
            }
            if (result.body && result.body.length < 200 && !result.body.includes('<html>')) {
                console.log(`      Body: ${result.body}`);
            }
        }
    }

    // Try Tapo-specific POST
    console.log('\n🔍 Trying Tapo API requests...\n');

    const tapoRequests = [
        { method: 'get_device_info' },
        { method: 'handshake', params: { key: 'test' } },
        { method: 'login', params: { username: 'test', password: 'test' } }
    ];

    for (const req of tapoRequests) {
        const result = await httpPost('/app', JSON.stringify(req));
        if (result.error) {
            console.log(`   ${req.method.padEnd(20)} - Error: ${result.error}`);
        } else {
            console.log(`   ${req.method.padEnd(20)} - ${result.statusCode}`);
            if (result.body && result.body.length < 300) {
                console.log(`      Response: ${result.body}`);
            }
        }
    }

    // Try TP-Link Kasa protocol (port 9999, TCP)
    console.log('\n🔍 Trying TP-Link Kasa protocol...\n');

    const kasaCommand = Buffer.from(JSON.stringify({
        system: { get_sysinfo: {} }
    }));

    // Kasa uses a simple XOR encryption with key 171 (0xAB)
    const encrypted = Buffer.alloc(kasaCommand.length + 4);
    encrypted.writeUInt32BE(kasaCommand.length, 0);
    let key = 171;
    for (let i = 0; i < kasaCommand.length; i++) {
        encrypted[i + 4] = kasaCommand[i] ^ key;
        key = encrypted[i + 4];
    }

    try {
        const socket = new net.Socket();
        socket.setTimeout(3000);

        socket.on('data', (data) => {
            console.log('   ✓ Kasa protocol response received!');
            // Decrypt response
            let decKey = 171;
            const decrypted = [];
            for (let i = 4; i < data.length; i++) {
                const byte = data[i] ^ decKey;
                decrypted.push(byte);
                decKey = data[i];
            }
            const response = Buffer.from(decrypted).toString();
            console.log('   Response:', response.substring(0, 500));
            socket.destroy();
        });

        socket.on('timeout', () => {
            console.log('   ✗ Kasa protocol timeout');
            socket.destroy();
        });

        socket.on('error', (err) => {
            console.log('   ✗ Kasa protocol error:', err.message);
        });

        socket.connect(9999, TARGET_IP, () => {
            console.log('   Connected to port 9999, sending Kasa command...');
            socket.write(encrypted);
        });
    } catch (err) {
        console.log('   ✗ Kasa connection failed:', err.message);
    }

    // Wait a bit for async operations
    await new Promise(resolve => setTimeout(resolve, 4000));

    console.log('\n' + '═'.repeat(70));
    console.log('CONCLUSION:');
    console.log('═'.repeat(70));
    console.log('\nServer identifies as "SHIP 2.0" which suggests this might be:');
    console.log('  • A TP-Link Tapo device (uses SHIP protocol)');
    console.log('  • But not responding to standard Tapo API calls');
    console.log('  • Might need the tp-link-tapo-connect library for authentication');
    console.log('\n💡 To confirm and control this device:');
    console.log('  1. Check in Tapo app: Device Settings → Device Info → IP Address');
    console.log('  2. Update tapo-control.js with this IP if confirmed');
    console.log('  3. Install: npm install tp-link-tapo-connect');
    console.log(`  4. Test: node tapo-control.js status <plug-name>\n`);
}

main().catch(err => console.error('Error:', err));
