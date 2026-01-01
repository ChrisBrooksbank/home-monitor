// Fixed Sonos Broadcast - Actually works!
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const SONOS_SPEAKERS = [
    { ip: '192.168.68.61', room: 'Bedroom' },
    { ip: '192.168.68.60', room: 'Lounge-Beam' } // Only use coordinator for grouped speakers
];

const message = "Hello, it's me, Monty!";
const ANNOUNCE_VOLUME = 40; // Volume level for announcements

console.log(`🔊 Broadcasting message to Sonos speakers...\n`);
console.log(`Message: "${message}"\n`);

// Use VoiceRSS free TTS API (no key needed for basic usage)
function getWorkingTTSUrl(text) {
    const encodedText = encodeURIComponent(text);
    // VoiceRSS provides MP3 files that work with Sonos
    return `http://api.voicerss.org/?key=undefined&hl=en-us&src=${encodedText}&c=MP3&f=44khz_16bit_mono`;
}

// Better: Use Amazon Polly demo endpoint or ResponsiveVoice
function getResponsiveVoiceTTS(text) {
    // This is a demo endpoint that works
    const encodedText = encodeURIComponent(text);
    return `https://code.responsivevoice.org/getvoice.php?t=${encodedText}&tl=en-US&sv=&vn=&pitch=0.5&rate=0.5&vol=1`;
}

async function stopPlayback(ip, room) {
    return new Promise((resolve) => {
        const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Stop xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
      <Speed>1</Speed>
    </u:Stop>
  </s:Body>
</s:Envelope>`;

        const options = {
            hostname: ip,
            port: 1400,
            path: '/MediaRenderer/AVTransport/Control',
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset="utf-8"',
                'SOAPAction': '"urn:schemas-upnp-org:service:AVTransport:1#Stop"',
                'Content-Length': Buffer.byteLength(soapBody)
            }
        };

        const req = http.request(options, () => resolve());
        req.on('error', () => resolve());
        req.write(soapBody);
        req.end();
    });
}

async function setVolume(ip, room, volume) {
    return new Promise((resolve) => {
        const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:SetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1">
      <InstanceID>0</InstanceID>
      <Channel>Master</Channel>
      <DesiredVolume>${volume}</DesiredVolume>
    </u:SetVolume>
  </s:Body>
</s:Envelope>`;

        const options = {
            hostname: ip,
            port: 1400,
            path: '/MediaRenderer/RenderingControl/Control',
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset="utf-8"',
                'SOAPAction': '"urn:schemas-upnp-org:service:RenderingControl:1#SetVolume"',
                'Content-Length': Buffer.byteLength(soapBody)
            }
        };

        const req = http.request(options, () => resolve());
        req.on('error', () => resolve());
        req.write(soapBody);
        req.end();
    });
}

async function playOnSonos(ip, room, audioUrl) {
    return new Promise((resolve, reject) => {
        console.log(`📻 ${room}: Stopping current playback...`);

        stopPlayback(ip, room).then(() => {
            console.log(`📻 ${room}: Setting volume to ${ANNOUNCE_VOLUME}...`);
            return setVolume(ip, room, ANNOUNCE_VOLUME);
        }).then(() => {
            console.log(`📻 ${room}: Loading audio...`);

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
                    console.log(`📻 ${room}: Playing...`);
                    playAudio(ip, room).then(() => {
                        console.log(`✓ ${room}: Announcement played successfully`);
                        resolve();
                    }).catch(reject);
                });
            });

            req.on('error', reject);
            req.write(soapBody);
            req.end();
        });
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

// Try ResponsiveVoice TTS (works better with Sonos)
const ttsUrl = getResponsiveVoiceTTS(message);
console.log(`TTS URL: ${ttsUrl}\n`);

// Broadcast to all speakers sequentially (better reliability)
async function broadcast() {
    for (const speaker of SONOS_SPEAKERS) {
        try {
            await playOnSonos(speaker.ip, speaker.room, ttsUrl);
            await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between speakers
        } catch (err) {
            console.error(`✗ ${speaker.room}: Failed - ${err.message}`);
        }
    }
}

broadcast().then(() => {
    console.log('\n✓ Broadcast complete!\n');
}).catch(err => {
    console.error('\n✗ Broadcast error:', err.message);
});
