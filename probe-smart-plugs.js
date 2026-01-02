// Probe potential smart plugs
const net = require('net');
const http = require('http');
const dgram = require('dgram');

const devices = [
  '192.168.68.60',
  '192.168.68.61',
  '192.168.68.62',
  '192.168.68.63'
];

const ports = [
  { port: 9999, protocol: 'TP-Link Kasa' },
  { port: 55443, protocol: 'Wemo/UPnP' },
  { port: 49153, protocol: 'UPnP' },
  { port: 80, protocol: 'HTTP' },
  { port: 443, protocol: 'HTTPS' },
  { port: 8008, protocol: 'HTTP Alt' }
];

async function checkPort(ip, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);

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

async function scanDevice(ip) {
  console.log(`\nScanning ${ip}...`);
  const openPorts = [];

  for (const portInfo of ports) {
    const isOpen = await checkPort(ip, portInfo.port);
    if (isOpen) {
      console.log(`  ✓ Port ${portInfo.port} OPEN (${portInfo.protocol})`);
      openPorts.push(portInfo);
    }
  }

  if (openPorts.length === 0) {
    console.log('  No common smart plug ports open');
  }

  return openPorts;
}

async function main() {
  console.log('=== Probing Smart Plug Ports ===');

  for (const ip of devices) {
    await scanDevice(ip);
  }

  console.log('\n=== Scan Complete ===\n');
}

main();
