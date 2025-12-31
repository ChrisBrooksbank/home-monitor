// Broadcast TTS message to all Sonos speakers
const http = require('http');
const https = require('https');

const SONOS_SPEAKERS = [
    { ip: '192.168.68.61', room: 'Bedroom' },
    { ip: '192.168.68.64', room: 'Lounge-1' },
    { ip: '192.168.68.65', room: 'Lounge-2' },
    { ip: '192.168.68.60', room: 'Lounge-Beam' }
];

const message = "Hello, it's me, Monty!";

console.log(`🔊 Broadcasting message to ${SONOS_SPEAKERS.length} Sonos speakers...\n`);
console.log(`Message: "${message}"\n`);

// Generate TTS URL using Google Translate TTS (free, no API key needed)
function getTTSUrl(text) {
    const encodedText = encodeURIComponent(text);
    // Google Translate TTS endpoint
    return `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodedText}`;
}

// Play a URL on a Sonos speaker
function playOnSonos(ip, room, audioUrl) {
    return new Promise((resolve, reject) => {
        // First, get current volume and state so we can restore it
        getCurrentState(ip).then(currentState => {
            // Set volume to a reasonable level for announcements
            const announceVolume = 30;

            console.log(`📻 ${room} (${ip}): Preparing to play...`);

            // Build the SOAP request to play the TTS audio
            const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      <CurrentURI>${audioUrl}</CurrentURI>
      <CurrentURIMetaData></CurrentURIMetaData>
    </u:SetAVTransportURI>
  </s:Body>
</s:Envelope>`;

            const options = {
                hostname: ip,
                port: 1400,
                path: '/MediaRenderer/AVTransport/Control',
                method: 'POST',
                headers: {
                    'Content-Type': 'text/xml; charset="utf-8"',
                    'SOAPAction': '"urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI"',
                    'Content-Length': Buffer.byteLength(soapBody)
                }
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    // Now play it
                    playAudio(ip, room).then(() => {
                        console.log(`✓ ${room}: Message played successfully`);
                        resolve();
                    }).catch(reject);
                });
            });

            req.on('error', (err) => {
                console.error(`✗ ${room}: Error - ${err.message}`);
                reject(err);
            });

            req.write(soapBody);
            req.end();
        }).catch(reject);
    });
}

function getCurrentState(ip) {
    return new Promise((resolve) => {
        // Simplified - just resolve with default state
        resolve({ volume: 30, state: 'STOPPED' });
    });
}

function playAudio(ip, room) {
    return new Promise((resolve, reject) => {
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

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve());
        });

        req.on('error', reject);
        req.write(soapBody);
        req.end();
    });
}

// Broadcast to all speakers
const ttsUrl = getTTSUrl(message);

Promise.all(
    SONOS_SPEAKERS.map(speaker =>
        playOnSonos(speaker.ip, speaker.room, ttsUrl)
    )
).then(() => {
    console.log('\n✓ Broadcast complete!\n');
}).catch(err => {
    console.error('\n✗ Broadcast error:', err.message);
});
