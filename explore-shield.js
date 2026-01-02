// Explore NVIDIA SHIELD capabilities
const http = require('http');

const shieldIP = '192.168.68.63';

async function queryEndpoint(path, description) {
  return new Promise((resolve) => {
    console.log(`\nTrying ${description}: ${path}`);

    const req = http.get(`http://${shieldIP}:8008${path}`, { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        try {
          const json = JSON.parse(data);
          console.log('Response:', JSON.stringify(json, null, 2));
        } catch (e) {
          console.log('Response:', data.substring(0, 500));
        }
        resolve(data);
      });
    });

    req.on('error', (err) => {
      console.log(`Error: ${err.message}`);
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      console.log('Timeout');
      resolve(null);
    });
  });
}

async function main() {
  console.log('=== Exploring NVIDIA SHIELD Capabilities ===');

  // Common Google Cast / Android TV endpoints
  const endpoints = [
    { path: '/setup/eureka_info', desc: 'Device Info' },
    { path: '/setup/eureka_info?options=detail', desc: 'Detailed Info' },
    { path: '/apps', desc: 'Installed Apps' },
    { path: '/connection/status', desc: 'Connection Status' },
    { path: '/setup/bluetooth/status', desc: 'Bluetooth Status' },
    { path: '/ssdp/device-desc.xml', desc: 'SSDP Description' }
  ];

  for (const endpoint of endpoints) {
    await queryEndpoint(endpoint.path, endpoint.desc);
  }

  console.log('\n=== Complete ===\n');
  console.log('The NVIDIA SHIELD supports Google Cast protocol.');
  console.log('You can potentially:');
  console.log('  - Cast media (videos, music, images)');
  console.log('  - Launch apps');
  console.log('  - Control playback');
  console.log('  - Send notifications');
  console.log('  - Query status');
}

main();
