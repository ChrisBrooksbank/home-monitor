// Check what's playing on Sonos speakers
const http = require('http');

const BEDROOM_SPEAKER = '192.168.68.61';

function getNowPlaying(ip, room) {
    return new Promise((resolve, reject) => {
        const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:GetTransportInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
    </u:GetTransportInfo>
  </s:Body>
</s:Envelope>`;

        const options = {
            hostname: ip,
            port: 1400,
            path: '/MediaRenderer/AVTransport/Control',
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset="utf-8"',
                'SOAPAction': '"urn:schemas-upnp-org:service:AVTransport:1#GetTransportInfo"',
                'Content-Length': Buffer.byteLength(soapBody)
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                // Parse the SOAP response
                const stateMatch = data.match(/<CurrentTransportState>([^<]+)<\/CurrentTransportState>/);
                const state = stateMatch ? stateMatch[1] : 'UNKNOWN';

                // Now get position info (track details)
                getPositionInfo(ip, room, state).then(resolve).catch(reject);
            });
        });

        req.on('error', reject);
        req.write(soapBody);
        req.end();
    });
}

function getPositionInfo(ip, room, state) {
    return new Promise((resolve, reject) => {
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
                // Extract track info
                const titleMatch = data.match(/<dc:title>([^<]+)<\/dc:title>/);
                const artistMatch = data.match(/<dc:creator>([^<]+)<\/dc:creator>/);
                const albumMatch = data.match(/<upnp:album>([^<]+)<\/upnp:album>/);
                const durationMatch = data.match(/<TrackDuration>([^<]+)<\/TrackDuration>/);
                const positionMatch = data.match(/<RelTime>([^<]+)<\/RelTime>/);

                const title = titleMatch ? titleMatch[1] : null;
                const artist = artistMatch ? artistMatch[1] : null;
                const album = albumMatch ? albumMatch[1] : null;
                const duration = durationMatch ? durationMatch[1] : null;
                const position = positionMatch ? positionMatch[1] : null;

                console.log(`\n🎵 ${room} Speaker (${ip})`);
                console.log(`   State: ${state}`);

                if (state === 'PLAYING' || state === 'PAUSED_PLAYBACK') {
                    if (title) {
                        console.log(`   Track: ${title}`);
                        if (artist) console.log(`   Artist: ${artist}`);
                        if (album) console.log(`   Album: ${album}`);
                        if (position && duration) {
                            console.log(`   Position: ${position} / ${duration}`);
                        }
                    } else {
                        console.log(`   No track information available`);
                    }
                } else {
                    console.log(`   Nothing playing`);
                }

                resolve({ room, state, title, artist, album });
            });
        });

        req.on('error', reject);
        req.write(soapBody);
        req.end();
    });
}

console.log('🔍 Checking Bedroom speaker...\n');
getNowPlaying(BEDROOM_SPEAKER, 'Bedroom')
    .then(() => console.log('\n✓ Done\n'))
    .catch(err => console.error('Error:', err.message));
