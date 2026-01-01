// Quick broadcast to office speaker
const http = require('http');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');

const OFFICE_IP = '192.168.68.75';
const message = 'Hello from the office!';
const ANNOUNCE_VOLUME = 40;
const HTTP_PORT = 8766; // Different port from before

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

async function generateAudioFile() {
    return new Promise((resolve, reject) => {
        const outputFile = 'office-message.wav';
        const psCommand = `Add-Type -AssemblyName System.Speech; $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer; $synth.SetOutputToWaveFile('${outputFile}'); $synth.Speak('${message}'); $synth.Dispose();`;

        console.log('🎤 Generating audio file using Windows TTS...');
        exec(`powershell -Command "${psCommand}"`, (error) => {
            if (error) {
                reject(error);
            } else {
                console.log(`✓ Audio file generated: ${outputFile}`);
                resolve(outputFile);
            }
        });
    });
}

function startAudioServer(audioFile) {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            console.log(`📥 Audio request from ${req.connection.remoteAddress}`);

            if (req.url === '/message.wav') {
                const stat = fs.statSync(audioFile);
                res.writeHead(200, {
                    'Content-Type': 'audio/wav',
                    'Content-Length': stat.size,
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
            console.log(`🌐 Audio server running at http://${localIP}:${HTTP_PORT}/message.wav`);
            resolve(server);
        });
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

        const req = http.request(options, () => setTimeout(resolve, 300));
        req.on('error', () => resolve());
        req.write(soapBody);
        req.end();
    });
}

async function playOnSonos(ip, audioUrl) {
    return new Promise((resolve, reject) => {
        console.log(`📻 Setting volume to ${ANNOUNCE_VOLUME}...`);

        setVolume(ip, ANNOUNCE_VOLUME).then(() => {
            console.log('📻 Loading audio...');

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
                res.on('data', () => {});
                res.on('end', () => {
                    setTimeout(() => {
                        console.log('📻 Playing...');
                        playAudio(ip).then(() => {
                            console.log('✓ Announcement playing');
                            resolve();
                        }).catch(reject);
                    }, 1000);
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
        console.log(`🔊 Broadcasting to office speaker: "${message}"\n`);

        const audioFile = await generateAudioFile();
        const server = await startAudioServer(audioFile);
        const audioUrl = `http://${localIP}:${HTTP_PORT}/message.wav`;

        // Wait a bit for server to be ready
        await new Promise(resolve => setTimeout(resolve, 500));

        await playOnSonos(OFFICE_IP, audioUrl);

        console.log('\n✓ Broadcast initiated!');
        console.log('Keeping server running for 30 seconds...\n');

        setTimeout(() => {
            server.close();
            console.log('✓ Server closed');
            process.exit(0);
        }, 30000);

    } catch (err) {
        console.error('✗ Error:', err.message);
        process.exit(1);
    }
}

main();
