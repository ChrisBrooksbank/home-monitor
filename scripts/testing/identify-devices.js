// Try to identify devices on port 8008
const http = require('http');

const devices = [
  '192.168.68.62',
  '192.168.68.63'
];

async function queryDevice(ip) {
  return new Promise((resolve) => {
    console.log(`\nQuerying ${ip}:8008...`);

    // Try Google Cast endpoint
    const req = http.get(`http://${ip}:8008/setup/eureka_info`, { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const info = JSON.parse(data);
          console.log(`Device Type: ${info.device_info?.manufacturer || 'Unknown'} ${info.device_info?.model_name || ''}`);
          console.log(`Name: ${info.name || 'Unknown'}`);
          resolve(info);
        } catch (e) {
          console.log('Response (not JSON):', data.substring(0, 200));
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      console.log(`Error: ${err.message}`);
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      console.log('Request timeout');
      resolve(null);
    });
  });
}

async function main() {
  console.log('=== Identifying Devices on Port 8008 ===');

  for (const ip of devices) {
    await queryDevice(ip);
  }

  console.log('\n=== Complete ===\n');
}

main();
