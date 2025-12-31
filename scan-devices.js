// Network Device Scanner
const http = require('http');

const devices = [
    { ip: '192.168.68.50', mac: '1c-f2-9a-4b-91-c0' },
    { ip: '192.168.68.51', mac: '00-17-88-25-83-4f' },  // Known: Hue Bridge
    { ip: '192.168.68.58', mac: '3c-8d-20-ff-f8-12' },
    { ip: '192.168.68.60', mac: '48-a6-b8-3e-de-8e' },
    { ip: '192.168.68.61', mac: '5c-aa-fd-b9-1a-fa' },
    { ip: '192.168.68.62', mac: '64-95-6c-94-85-d3' },
    { ip: '192.168.68.63', mac: '3c-6d-66-01-cb-fc' },
    { ip: '192.168.68.64', mac: '48-a6-b8-3e-de-8e' },
    { ip: '192.168.68.65', mac: '48-a6-b8-3e-de-8e' }
];

console.log('\n=== Scanning Network Devices ===\n');

async function identifyDevice(device) {
    return new Promise((resolve) => {
        // Try common HTTP endpoint
        const req = http.get(`http://${device.ip}/`, { timeout: 2000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const headers = JSON.stringify(res.headers);
                const bodyPreview = data.substring(0, 200).toLowerCase();

                let deviceType = 'Unknown HTTP Device';

                // Check for device signatures
                if (bodyPreview.includes('philips') || bodyPreview.includes('hue')) {
                    deviceType = 'Philips Hue Bridge';
                } else if (headers.includes('nest') || bodyPreview.includes('nest')) {
                    deviceType = 'Nest Device';
                } else if (bodyPreview.includes('router') || bodyPreview.includes('gateway')) {
                    deviceType = 'Router/Gateway';
                } else if (bodyPreview.includes('printer')) {
                    deviceType = 'Printer';
                } else if (res.headers.server) {
                    deviceType = `HTTP Server (${res.headers.server})`;
                }

                resolve({ ...device, type: deviceType, responding: true });
            });
        });

        req.on('error', () => {
            resolve({ ...device, type: 'Not responding on HTTP', responding: false });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ ...device, type: 'HTTP timeout', responding: false });
        });
    });
}

async function scanAll() {
    console.log('Scanning devices...\n');

    for (const device of devices) {
        const result = await identifyDevice(device);

        console.log(`IP: ${result.ip}`);
        console.log(`MAC: ${result.mac}`);
        console.log(`Type: ${result.type}`);

        // Check MAC vendor prefix
        const macPrefix = result.mac.substring(0, 8).toUpperCase();
        if (macPrefix === '00-17-88') console.log('  → Philips/Signify device');
        if (macPrefix.startsWith('18-B4-30') || macPrefix.startsWith('64-16-66')) {
            console.log('  → Possible Nest device!');
        }

        console.log('');
    }

    console.log('\n=== Scan Complete ===\n');
    console.log('Note: Nest thermostats use cloud API and may not be detectable via local network scan.');
    console.log('If you have a Nest, you would need to integrate via Google Nest API with OAuth.');
}

scanAll();
