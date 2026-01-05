// Tapo Plug Auto-Discovery
// Finds Tapo plugs by probing the Tapo API on all IPs in range

const http = require('http');

// Probe a single IP for Tapo API
function probeTapo(ip, timeout = 3000) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ method: 'get_device_info' });
    const req = http.request({
      hostname: ip,
      port: 80,
      path: '/app',
      method: 'POST',
      timeout: timeout,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Accept': '*/*'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Tapo devices return JSON with error_code (1003 = needs auth, -1 = other)
        if (data.includes('error_code')) {
          resolve({ ip, isTapo: true, response: data });
        } else {
          resolve({ ip, isTapo: false });
        }
      });
    });

    req.on('error', () => resolve({ ip, isTapo: false }));
    req.on('timeout', () => { req.destroy(); resolve({ ip, isTapo: false }); });
    req.write(body);
    req.end();
  });
}

// Probe multiple IPs in parallel batches
async function probeRange(baseIp, start, end, batchSize = 10) {
  const results = [];

  for (let i = start; i <= end; i += batchSize) {
    const batch = [];
    for (let j = i; j < Math.min(i + batchSize, end + 1); j++) {
      batch.push(probeTapo(`${baseIp}.${j}`));
    }
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);

    // Progress indicator
    const found = results.filter(r => r.isTapo).length;
    process.stdout.write(`\rScanning ${baseIp}.${i}-${Math.min(i + batchSize - 1, end)}... Found: ${found} plugs`);
  }
  console.log('');

  return results.filter(r => r.isTapo);
}

// Main discovery function
async function discoverTapoPlugs(options = {}) {
  const {
    baseIp = '192.168.68',
    start = 50,
    end = 100
  } = options;

  console.log('=== Tapo Plug Discovery ===');
  console.log(`Scanning ${baseIp}.${start} to ${baseIp}.${end}\n`);

  const startTime = Date.now();
  const tapoPlugs = await probeRange(baseIp, start, end);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n=== Found ${tapoPlugs.length} Tapo plug(s) in ${elapsed}s ===\n`);
  tapoPlugs.forEach(p => console.log(`  ${p.ip}`));

  return tapoPlugs.map(p => ({ ip: p.ip }));
}

// Run if called directly
if (require.main === module) {
  // Scan wider range to find moved plugs
  discoverTapoPlugs({ start: 50, end: 90 }).then(plugs => {
    console.log('\nJSON output:');
    console.log(JSON.stringify(plugs, null, 2));
  });
}

module.exports = { discoverTapoPlugs, probeTapo };
