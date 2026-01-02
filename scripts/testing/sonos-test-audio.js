// Test Sonos with a known working audio file
const http = require('http');

const SPEAKERS = [
    { ip: '192.168.68.61', room: 'Bedroom' }
];

// Use a public test MP3 file
const TEST_AUDIO = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

async function stopAndPlay(ip, room, audioUrl) {
    // Stop first
    await sendSoapCommand(ip, 'Stop', `
        <u:Stop xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
            <InstanceID>0</InstanceID>
        </u:Stop>
    `);
    console.log(`⏹  ${room}: Stopped`);

    await new Promise(r => setTimeout(r, 500));

    // Set volume
    await sendSoapCommand(ip, 'SetVolume', `
        <u:SetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1">
            <InstanceID>0</InstanceID>
            <Channel>Master</Channel>
            <DesiredVolume>30</DesiredVolume>
        </u:SetVolume>
    `, '/MediaRenderer/RenderingControl/Control', 'RenderingControl');
    console.log(`🔊 ${room}: Volume set to 30`);

    await new Promise(r => setTimeout(r, 500));

    // Set URI
    await sendSoapCommand(ip, 'SetAVTransportURI', `
        <u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
            <InstanceID>0</InstanceID>
            <CurrentURI>${audioUrl}</CurrentURI>
            <CurrentURIMetaData></CurrentURIMetaData>
        </u:SetAVTransportURI>
    `);
    console.log(`📻 ${room}: URI loaded`);

    await new Promise(r => setTimeout(r, 1000));

    // Play
    await sendSoapCommand(ip, 'Play', `
        <u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
            <InstanceID>0</InstanceID>
            <Speed>1</Speed>
        </u:Play>
    `);
    console.log(`▶️  ${room}: Playing`);
}

function sendSoapCommand(ip, action, body, path = '/MediaRenderer/AVTransport/Control', service = 'AVTransport') {
    return new Promise((resolve, reject) => {
        const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    ${body}
  </s:Body>
</s:Envelope>`;

        const options = {
            hostname: ip,
            port: 1400,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset="utf-8"',
                'SOAPAction': `"urn:schemas-upnp-org:service:${service}:1#${action}"`,
                'Content-Length': Buffer.byteLength(soapBody)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    console.log(`Error response:`, data.substring(0, 200));
                }
                resolve();
            });
        });

        req.on('error', reject);
        req.write(soapBody);
        req.end();
    });
}

console.log('🎵 Testing Sonos with public MP3 file...\n');
console.log(`Audio: ${TEST_AUDIO}\n`);

stopAndPlay(SPEAKERS[0].ip, SPEAKERS[0].room, TEST_AUDIO)
    .then(() => console.log('\n✓ Test complete - you should hear music!'))
    .catch(err => console.error('Error:', err));
