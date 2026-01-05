// Identify Tapo plugs by connecting and getting device info
// Uses credentials from environment variables or .env file
// Usage: node identify-plugs.cjs

require('dotenv').config();
const { loginDeviceByIp } = require('tp-link-tapo-connect');

const EMAIL = process.env.TAPO_EMAIL;
const PASSWORD = process.env.TAPO_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('ERROR: Set TAPO_EMAIL and TAPO_PASSWORD in .env file');
  process.exit(1);
}

// Run discovery first to get IPs, or specify them here
const DISCOVERED_IPS = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : [
      '192.168.68.50',
      '192.168.68.59',
      '192.168.68.60',
      '192.168.68.62',
      '192.168.68.76',
      '192.168.68.78'
    ];

async function identifyPlug(ip) {
  try {
    console.log(`Connecting to ${ip}...`);
    const device = await loginDeviceByIp(EMAIL, PASSWORD, ip);
    const info = await device.getDeviceInfo();

    return {
      ip,
      nickname: info.nickname || 'Unknown',
      model: info.model,
      state: info.device_on ? 'ON' : 'OFF',
      mac: info.mac,
      rssi: info.rssi
    };
  } catch (error) {
    return { ip, error: error.message };
  }
}

async function main() {
  console.log('=== Identifying Tapo Plugs ===\n');

  const results = [];
  for (const ip of DISCOVERED_IPS) {
    const info = await identifyPlug(ip);
    results.push(info);

    if (info.error) {
      console.log(`  ${ip}: ERROR - ${info.error}`);
    } else {
      console.log(`  ${ip}: "${info.nickname}" (${info.model}) - ${info.state}`);
    }
  }

  console.log('\n=== Suggested PLUGS config ===\n');
  const plugConfig = {};
  for (const r of results) {
    if (!r.error && r.nickname) {
      const key = r.nickname.toLowerCase().replace(/\s+/g, '-');
      plugConfig[key] = r.ip;
    }
  }
  console.log(JSON.stringify(plugConfig, null, 2));

  return results;
}

main();
