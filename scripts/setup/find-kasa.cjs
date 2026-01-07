// Find Kasa HS100/HS110 smart plugs on network
const net = require('net');

const SUBNET = '192.168.68';
const START_IP = 1;
const END_IP = 254;
const KASA_PORT = 9999;
const TIMEOUT = 1000;

// Kasa encryption/decryption (simple XOR with autokey)
function encrypt(plaintext) {
    const buf = Buffer.from(plaintext);
    let key = 171; // 0xAB
    const encrypted = Buffer.alloc(buf.length);

    for (let i = 0; i < buf.length; i++) {
        encrypted[i] = buf[i] ^ key;
        key = encrypted[i];
    }

    return encrypted;
}

function decrypt(encrypted) {
    let key = 171; // 0xAB
    const decrypted = Buffer.alloc(encrypted.length);

    for (let i = 0; i < encrypted.length; i++) {
        const byte = encrypted[i];
        decrypted[i] = byte ^ key;
        key = byte;
    }

    return decrypted.toString();
}

// Get device info command
const getInfoCommand = JSON.stringify({
    system: { get_sysinfo: {} }
});

async function probeKasa(ip) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(TIMEOUT);

        let responseData = Buffer.alloc(0);

        socket.on('connect', () => {
            const encrypted = encrypt(getInfoCommand);
            const packet = Buffer.alloc(4 + encrypted.length);
            packet.writeUInt32BE(encrypted.length, 0);
            encrypted.copy(packet, 4);
            socket.write(packet);
        });

        socket.on('data', (data) => {
            responseData = Buffer.concat([responseData, data]);
        });

        socket.on('close', () => {
            if (responseData.length > 4) {
                try {
                    const decrypted = decrypt(responseData.slice(4));
                    const info = JSON.parse(decrypted);

                    if (info.system && info.system.get_sysinfo) {
                        const sysinfo = info.system.get_sysinfo;
                        resolve({
                            ip: ip,
                            found: true,
                            model: sysinfo.model || 'Unknown',
                            alias: sysinfo.alias || 'Unnamed',
                            mac: sysinfo.mac || 'Unknown',
                            deviceId: sysinfo.deviceId || 'Unknown'
                        });
                        return;
                    }
                } catch (e) {
                    // Not a valid response
                }
            }
            resolve({ ip, found: false });
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve({ ip, found: false });
        });

        socket.on('error', () => {
            resolve({ ip, found: false });
        });

        socket.connect(KASA_PORT, ip);
    });
}

async function scanForKasa() {
    console.log('════════════════════════════════════════════════════════════');
    console.log('KASA SMART PLUG FINDER (HS100/HS110)');
    console.log('════════════════════════════════════════════════════════════\n');
    console.log(`🔍 Scanning ${SUBNET}.${START_IP}-${END_IP} for Kasa devices...\n`);

    const devices = [];
    const batchSize = 20;

    for (let i = START_IP; i <= END_IP; i += batchSize) {
        const batch = [];
        const end = Math.min(i + batchSize - 1, END_IP);

        for (let j = i; j <= end; j++) {
            const ip = `${SUBNET}.${j}`;
            batch.push(probeKasa(ip));
        }

        const results = await Promise.all(batch);

        results.forEach(result => {
            if (result.found) {
                devices.push(result);
                console.log(`✅ FOUND Kasa Device!`);
                console.log(`   IP: ${result.ip}`);
                console.log(`   Model: ${result.model}`);
                console.log(`   Name: ${result.alias}`);
                console.log(`   MAC: ${result.mac}`);
                console.log('');
            }
        });

        process.stdout.write(`\rProgress: ${Math.min(end, END_IP)}/${END_IP} (${Math.round((end/END_IP)*100)}%)`);
    }

    console.log('\n\n════════════════════════════════════════════════════════════');
    console.log('SCAN RESULTS');
    console.log('════════════════════════════════════════════════════════════\n');

    if (devices.length > 0) {
        console.log(`Found ${devices.length} Kasa device(s):\n`);
        devices.forEach(d => {
            console.log(`📌 ${d.alias} (${d.model})`);
            console.log(`   IP: ${d.ip}`);
            console.log(`   MAC: ${d.mac}`);
        });
        console.log('\n💡 Add these to your configuration!');
    } else {
        console.log('❌ No Kasa devices found');
        console.log('\nPossible reasons:');
        console.log('   • Devices are powered off');
        console.log('   • Devices are on a different network');
        console.log('   • Firewall blocking port 9999');
    }
    console.log('');
}

scanForKasa().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
