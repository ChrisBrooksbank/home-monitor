// Identify MAC address vendors
const macs = [
  { mac: '1c-f2-9a-4b-91-c0', ip: '192.168.68.50' },
  { mac: '3c-8d-20-ff-f8-12', ip: '192.168.68.58' },
  { mac: '48-a6-b8-3e-de-8e', ip: '192.168.68.60' },
  { mac: '5c-aa-fd-b9-1a-fa', ip: '192.168.68.61' },
  { mac: '64-95-6c-94-85-d3', ip: '192.168.68.62' },
  { mac: '3c-6d-66-01-cb-fc', ip: '192.168.68.63' }
];

// Common smart plug MAC prefixes
const vendors = {
  '50-C7-BF': 'TP-Link (Kasa)',
  'B0-95-75': 'TP-Link (Kasa)',
  '1C-3B-F3': 'TP-Link (Kasa)',
  'EC-1A-59': 'Belkin (WeMo)',
  'F4-5E-AB': 'Belkin (WeMo)',
  '48-E1-E9': 'Meross',
  '48-A6-B8': 'Espressif (ESP32/ESP8266 - Common in smart devices)',
  '5C-AA-FD': 'Shenzhen Bilian (Smart plugs/switches)',
  '64-95-6C': 'Unknown smart device',
  '3C-6D-66': 'Unknown smart device',
  '3C-8D-20': 'Sonos',
  '1C-F2-9A': 'Unknown device'
};

console.log('\nMAC Address Analysis:\n');
macs.forEach(device => {
  const prefix = device.mac.substring(0, 8).toUpperCase();
  const vendor = vendors[prefix] || 'Unknown vendor';
  console.log(`IP: ${device.ip}`);
  console.log(`MAC: ${device.mac}`);
  console.log(`Vendor: ${vendor}`);

  if (vendor.includes('smart') || vendor.includes('Espressif') || vendor.includes('Bilian')) {
    console.log('  *** Possible smart plug/switch ***');
  }
  console.log('');
});
