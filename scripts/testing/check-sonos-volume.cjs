// Check Sonos speaker volume and state
const http = require('http');

const SONOS_SPEAKERS = [
    { ip: '192.168.68.61', room: 'Bedroom' },
    { ip: '192.168.68.64', room: 'Lounge-1' },
    { ip: '192.168.68.65', room: 'Lounge-2' },
    { ip: '192.168.68.60', room: 'Lounge-Beam' }
];

function getVolume(ip, room) {
    return new Promise((resolve) => {
        const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:GetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1">
      <InstanceID>0</InstanceID>
      <Channel>Master</Channel>
    </u:GetVolume>
  </s:Body>
</s:Envelope>`;

        const options = {
            hostname: ip,
            port: 1400,
            path: '/MediaRenderer/RenderingControl/Control',
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset="utf-8"',
                'SOAPAction': '"urn:schemas-upnp-org:service:RenderingControl:1#GetVolume"',
                'Content-Length': Buffer.byteLength(soapBody)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const volumeMatch = data.match(/<CurrentVolume>([^<]+)<\/CurrentVolume>/);
                const volume = volumeMatch ? volumeMatch[1] : 'Unknown';
                console.log(`${room} (${ip}): Volume = ${volume}`);
                resolve();
            });
        });

        req.on('error', (err) => {
            console.log(`${room} (${ip}): Error - ${err.message}`);
            resolve();
        });

        req.write(soapBody);
        req.end();
    });
}

function getCurrentTrack(ip, room) {
    return new Promise((resolve) => {
        const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:GetPositionInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
    </u:GetPositionInfo>
  </s:Body>
</s:Envelope>`;

        const options = {
            hostname: ip,
            port: 1400,
            path: '/MediaRenderer/AVTransport/Control',
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset="utf-8"',
                'SOAPAction': '"urn:schemas-upnp-org:service:AVTransport:1#GetPositionInfo"',
                'Content-Length': Buffer.byteLength(soapBody)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const uriMatch = data.match(/<TrackURI>([^<]+)<\/TrackURI>/);
                const uri = uriMatch ? uriMatch[1] : 'None';
                console.log(`${room}: Current URI = ${uri.substring(0, 80)}${uri.length > 80 ? '...' : ''}`);
                resolve();
            });
        });

        req.on('error', () => resolve());
        req.write(soapBody);
        req.end();
    });
}

console.log('🔍 Checking Sonos speaker status...\n');
console.log('VOLUME LEVELS:');

Promise.all(SONOS_SPEAKERS.map(s => getVolume(s.ip, s.room)))
    .then(() => {
        console.log('\nCURRENT PLAYBACK:');
        return Promise.all(SONOS_SPEAKERS.map(s => getCurrentTrack(s.ip, s.room)));
    })
    .then(() => console.log('\n✓ Done\n'));
