// Sonos Broadcast using local HTTP server for audio
const http = require('http');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');

const SONOS_SPEAKERS = [
    { ip: '192.168.68.61', room: 'Bedroom' },
    { ip: '192.168.68.60', room: 'Lounge-Beam' }
];

const message = "Hello, it's me, Monty!";
const ANNOUNCE_VOLUME = 50;
const HTTP_PORT = 8765;

// Get local IP address
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

const localIP = getLocalIP();
console.log(`🔊 Local IP: ${localIP}\n`);

// Generate audio file using Windows SAPI (PowerShell)
async function generateAudioFile() {
    return new Promise((resolve, reject) => {
        const outputFile = 'monty-message.wav';

        // PowerShell command to generate WAV file using Windows TTS
        const psCommand = `
Add-Type -AssemblyName System.Speech;
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
$synth.SetOutputToWaveFile('${outputFile}');
$synth.Speak('${message}');
$synth.Dispose();
        `.trim();

        console.log('🎤 Generating audio file using Windows TTS...');

        exec(`powershell -Command "${psCommand}"`, (error) => {
            if (error) {
                console.error('PowerShell TTS failed, trying alternative...');
                // Fallback: create a simple test file
                reject(error);
            } else {
                console.log(`✓ Audio file generated: ${outputFile}\n`);
                resolve(outputFile);
            }
        });
    });
}

// Start HTTP server to serve the audio file
function startAudioServer(audioFile) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            console.log(`📥 Audio request from ${req.connection.remoteAddress}`);

            if (req.url === '/monty.wav') {
                res.writeHead(200, {
                    'Content-Type': 'audio/wav',
                    'Accept-Ranges': 'bytes'
                });

                const stream = fs.createReadStream(audioFile);
                stream.pipe(res);
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });

        server.listen(HTTP_PORT, () => {
            console.log(`🌐 Audio server running at http://${localIP}:${HTTP_PORT}/monty.wav\n`);
            resolve(server);
        });
    });
}

async function stopPlayback(ip) {
    return new Promise((resolve) => {
        const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:Stop xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
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

        const req = http.request(options, () => {
            setTimeout(resolve, 300); // Wait a bit for stop to take effect
        });
        req.on('error', () => resolve());
        req.write(soapBody);
        req.end();
    });
}

async function setVolume(ip, volume) {
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

        const req = http.request(options, () => setTimeout(resolve, 200));
        req.on('error', () => resolve());
        req.write(soapBody);
        req.end();
    });
}

async function playOnSonos(ip, room, audioUrl) {
    return new Promise((resolve, reject) => {
        console.log(`📻 ${room}: Stopping current playback...`);

        stopPlayback(ip).then(() => {
            console.log(`📻 ${room}: Setting volume to ${ANNOUNCE_VOLUME}...`);
            return setVolume(ip, ANNOUNCE_VOLUME);
        }).then(() => {
            console.log(`📻 ${room}: Loading audio from local server...`);

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
                    setTimeout(() => {
                        console.log(`📻 ${room}: Playing...`);
                        playAudio(ip).then(() => {
                            console.log(`✓ ${room}: Announcement should be playing`);
                            resolve();
                        }).catch(reject);
                    }, 500); // Wait for URI to be set
                });
            });

            req.on('error', reject);
            req.write(soapBody);
            req.end();
        });
    });
}

function playAudio(ip) {
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

        const req = http.request(options, () => resolve());
        req.on('error', reject);
        req.write(soapBody);
        req.end();
    });
}

async function main() {
    try {
        // Generate audio file
        const audioFile = await generateAudioFile();

        // Start HTTP server
        const server = await startAudioServer(audioFile);

        const audioUrl = `http://${localIP}:${HTTP_PORT}/monty.wav`;

        // Broadcast to speakers
        for (const speaker of SONOS_SPEAKERS) {
            await playOnSonos(speaker.ip, speaker.room, audioUrl);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('\n✓ Broadcast initiated!');
        console.log('Keeping server running for 30 seconds...\n');

        // Keep server running for a bit
        setTimeout(() => {
            server.close();
            console.log('✓ Server closed\n');
        }, 30000);

    } catch (err) {
        console.error('✗ Error:', err.message);
    }
}

main();
