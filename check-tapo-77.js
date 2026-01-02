// Quick check for Tapo device at 192.168.68.77
const net = require('net');
const http = require('http');
const https = require('https');

const TARGET_IP = '192.168.68.77';

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

async function checkTapoAPI(ip, port) {
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
                const isTapo = data.includes('error_code') ||
                              data.toLowerCase().includes('tapo') ||
                              res.headers['server']?.toLowerCase().includes('tapo');

                resolve({
                    responding: true,
                    statusCode: res.statusCode,
                    isTapo: isTapo,
                    response: data.substring(0, 300),
                    headers: res.headers
                });
            });
        });

        req.on('error', (err) => {
            resolve({ responding: false, error: err.message });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ responding: false, error: 'timeout' });
        });

        req.write(JSON.stringify({ method: 'get_device_info' }));
        req.end();
    });
}

async function main() {
    console.log('═'.repeat(60));
    console.log(`CHECKING TAPO DEVICE AT ${TARGET_IP}`);
    console.log('═'.repeat(60));

    // Check common ports
    console.log('\n🔍 Checking ports...');
    const port80 = await checkPort(TARGET_IP, 80);
    const port443 = await checkPort(TARGET_IP, 443);
    const port9999 = await checkPort(TARGET_IP, 9999);

    console.log(`   Port 80 (HTTP):  ${port80 ? '✓ OPEN' : '✗ closed'}`);
    console.log(`   Port 443 (HTTPS): ${port443 ? '✓ OPEN' : '✗ closed'}`);
    console.log(`   Port 9999 (Kasa): ${port9999 ? '✓ OPEN' : '✗ closed'}`);

    if (!port80 && !port443) {
        console.log('\n❌ Device not responding on Tapo ports');
        console.log('   • Check if device is powered on');
        console.log('   • Verify IP address is correct (check Tapo app)');
        console.log('   • Ensure device is on same network');
        process.exit(1);
    }

    // Try Tapo API
    console.log('\n🔍 Testing Tapo API...');
    const testPort = port80 ? 80 : 443;
    const result = await checkTapoAPI(TARGET_IP, testPort);

    if (result.responding) {
        console.log(`   ✓ Device responding on port ${testPort}`);
        console.log(`   Status code: ${result.statusCode}`);

        if (result.headers?.server) {
            console.log(`   Server: ${result.headers.server}`);
        }

        if (result.isTapo) {
            console.log('\n✅ CONFIRMED: This is a Tapo device!');
            console.log(`   IP: ${TARGET_IP}`);
            console.log(`   Protocol: ${testPort === 443 ? 'HTTPS' : 'HTTP'}`);
            console.log('\n📝 Next steps:');
            console.log(`   1. Add to tapo-control.js PLUGS object:`);
            console.log(`      'my-plug': '${TARGET_IP}'`);
            console.log(`   2. Update TAPO_EMAIL and TAPO_PASSWORD in tapo-control.js`);
            console.log(`   3. Test with: node tapo-control.js status my-plug`);
        } else {
            console.log('\n⚠️  Device is responding but may not be a Tapo device');
            console.log(`   Response sample: ${result.response}`);
        }
    } else {
        console.log(`   ✗ API not responding: ${result.error}`);
    }

    console.log('\n' + '═'.repeat(60));
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
