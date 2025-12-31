// Just send Play command to speakers
const http = require('http');

const SPEAKERS = [
    { ip: '192.168.68.61', room: 'Bedroom' },
    { ip: '192.168.68.60', room: 'Lounge-Beam' }
];

function playNow(ip, room) {
    return new Promise((resolve) => {
        const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      <Speed>1</Speed>
    </u:Play>
  </s:Body>
</s:Envelope>`;

        const options = {
            hostname: ip,
            port: 1400,
            path: '/MediaRenderer/AVTransport/Control',
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset="utf-8"',
                'SOAPAction': '"urn:schemas-upnp-org:service:AVTransport:1#Play"',
                'Content-Length': Buffer.byteLength(soapBody)
            }
        };

        console.log(`▶️  Sending Play command to ${room}...`);

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`✓ ${room}: Play command sent`);
                } else {
                    console.log(`✗ ${room}: Error ${res.statusCode}`);
                    console.log(data);
                }
                resolve();
            });
        });

        req.on('error', (err) => {
            console.error(`✗ ${room}: ${err.message}`);
            resolve();
        });

        req.write(soapBody);
        req.end();
    });
}

async function main() {
    for (const speaker of SPEAKERS) {
        await playNow(speaker.ip, speaker.room);
    }
    console.log('\n✓ Done');
}

main();
