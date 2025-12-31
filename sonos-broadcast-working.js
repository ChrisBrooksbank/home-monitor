// Working Sonos Broadcast with online TTS
const http = require('http');
const https = require('https');
const fs = require('fs');

const SONOS_SPEAKERS = [
    { ip: '192.168.68.61', room: 'Bedroom' },
    { ip: '192.168.68.60', room: 'Lounge-Beam' }
];

const message = "Hello, it's me, Monty!";
const ANNOUNCE_VOLUME = 45;

console.log(`🔊 Broadcasting: "${message}"\n`);

// Use FreeTTS API to generate MP3
function downloadTTS(text, filename) {
    return new Promise((resolve, reject) => {
        // Using a free TTS service (no API key needed)
        const encodedText = encodeURIComponent(text);
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodedText}`;

        console.log('🎤 Downloading TTS audio from Google Translate...');

        https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        }, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }

            const fileStream = fs.createWriteStream(filename);
            res.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                console.log(`✓ Audio file downloaded: ${filename}\n`);
                resolve(filename);
            });
        }).on('error', reject);
    });
}

async function stopAndPlay(ip, room, audioUrl) {
    console.log(`📻 ${room}: Processing...`);

    // Stop
    await sendSoapCommand(ip, 'Stop', `
        <u:Stop xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
            <InstanceID>0</InstanceID>
        </u:Stop>
    `);

    await new Promise(r => setTimeout(r, 300));

    // Set volume
    await sendSoapCommand(ip, 'SetVolume', `
        <u:SetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1">
            <InstanceID>0</InstanceID>
            <Channel>Master</Channel>
            <DesiredVolume>${ANNOUNCE_VOLUME}</DesiredVolume>
        </u:SetVolume>
    `, '/MediaRenderer/RenderingControl/Control', 'RenderingControl');

    await new Promise(r => setTimeout(r, 300));

    // Set URI
    await sendSoapCommand(ip, 'SetAVTransportURI', `
        <u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
            <InstanceID>0</InstanceID>
            <CurrentURI>${audioUrl}</CurrentURI>
            <CurrentURIMetaData></CurrentURIMetaData>
        </u:SetAVTransportURI>
    `);

    await new Promise(r => setTimeout(r, 800));

    // Play
    await sendSoapCommand(ip, 'Play', `
        <u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
            <InstanceID>0</InstanceID>
            <Speed>1</Speed>
        </u:Play>
    `);

    console.log(`✓ ${room}: Playing announcement`);
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
            res.on('end', () => resolve());
        });

        req.on('error', reject);
        req.write(soapBody);
        req.end();
    });
}

// Start local HTTP server to serve the audio
function startServer(audioFile) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            if (req.url === '/monty.mp3') {
                res.writeHead(200, {
                    'Content-Type': 'audio/mpeg',
                    'Accept-Ranges': 'bytes'
                });
                fs.createReadStream(audioFile).pipe(res);
            } else {
                res.writeHead(404);
                res.end();
            }
        });

        server.listen(8765, () => {
            const localIP = require('os').networkInterfaces()['Ethernet']?.find(i => i.family === 'IPv4')?.address || '10.5.0.2';
            const url = `http://${localIP}:8765/monty.mp3`;
            console.log(`🌐 Serving audio at: ${url}\n`);
            resolve({ server, url });
        });
    });
}

async function main() {
    try {
        // Download TTS audio
        const audioFile = 'monty-broadcast.mp3';
        await downloadTTS(message, audioFile);

        // Start server
        const { server, url } = await startServer(audioFile);

        // Broadcast to all speakers
        for (const speaker of SONOS_SPEAKERS) {
            await stopAndPlay(speaker.ip, speaker.room, url);
            await new Promise(r => setTimeout(r, 500));
        }

        console.log('\n✓ Broadcast complete!\n');
        console.log('Keeping server running for 30 seconds...\n');

        // Keep server alive
        setTimeout(() => {
            server.close();
            console.log('✓ Server closed');
        }, 30000);

    } catch (err) {
        console.error('✗ Error:', err.message);
    }
}

main();
