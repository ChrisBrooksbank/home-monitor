// Google Nest OAuth Authorization Flow
const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');

// Load credentials from nest-config.js if it exists
let CLIENT_ID, CLIENT_SECRET, PROJECT_ID, REDIRECT_URI;

try {
    const configContent = fs.readFileSync('./nest-config.js', 'utf8');
    eval(configContent);
    CLIENT_ID = NEST_CONFIG.CLIENT_ID;
    CLIENT_SECRET = NEST_CONFIG.CLIENT_SECRET;
    PROJECT_ID = NEST_CONFIG.PROJECT_ID;
    REDIRECT_URI = NEST_CONFIG.REDIRECT_URI || 'http://localhost:8080/auth/callback';
    console.log('✓ Loaded credentials from nest-config.js');
} catch (err) {
    console.error('✗ Could not load nest-config.js');
    console.error('Please create nest-config.js with your OAuth credentials first.');
    console.error('See nest-config.example.js for template.');
    process.exit(1);
}

console.log('\n=== Google Nest Authorization ===\n');

// Step 1: Generate authorization URL
const authUrl = 'https://nestservices.google.com/partnerconnections/' + PROJECT_ID + '/auth?' +
    'redirect_uri=' + encodeURIComponent(REDIRECT_URI) +
    '&access_type=offline' +
    '&prompt=consent' +
    '&client_id=' + encodeURIComponent(CLIENT_ID) +
    '&response_type=code' +
    '&scope=' + encodeURIComponent('https://www.googleapis.com/auth/sdm.service');

console.log('1. Open this URL in your browser:\n');
console.log(authUrl);
console.log('\n2. Log in with your Google account');
console.log('3. Grant permissions');
console.log('4. You will be redirected back to this script\n');
console.log('Starting local server on http://localhost:8080...\n');

// Step 2: Start local server to handle callback
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);

    if (parsedUrl.pathname === '/auth/callback') {
        const code = parsedUrl.query.code;

        if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>Error: No authorization code received</h1>');
            return;
        }

        console.log('✓ Received authorization code');
        console.log('Exchanging code for tokens...\n');

        // Step 3: Exchange code for access token and refresh token
        const tokenData = new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI
        }).toString();

        const options = {
            hostname: 'www.googleapis.com',
            port: 443,
            path: '/oauth2/v4/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': tokenData.length
            }
        };

        const tokenReq = https.request(options, (tokenRes) => {
            let data = '';
            tokenRes.on('data', chunk => data += chunk);
            tokenRes.on('end', () => {
                try {
                    const tokens = JSON.parse(data);

                    if (tokens.error) {
                        console.error('✗ Token exchange failed:', tokens.error);
                        res.writeHead(500, { 'Content-Type': 'text/html' });
                        res.end('<h1>Error: ' + tokens.error + '</h1>');
                        server.close();
                        return;
                    }

                    console.log('✓ Successfully received tokens!\n');
                    console.log('Access Token:', tokens.access_token.substring(0, 20) + '...');
                    console.log('Refresh Token:', tokens.refresh_token.substring(0, 20) + '...');
                    console.log('Expires in:', tokens.expires_in, 'seconds\n');

                    // Save tokens to config
                    const config = {
                        CLIENT_ID,
                        CLIENT_SECRET,
                        PROJECT_ID,
                        REDIRECT_URI,
                        access_token: tokens.access_token,
                        refresh_token: tokens.refresh_token,
                        expires_at: Date.now() + (tokens.expires_in * 1000)
                    };

                    fs.writeFileSync('nest-config.json', JSON.stringify(config, null, 2));
                    console.log('✓ Tokens saved to nest-config.json\n');

                    // Test the connection by fetching devices
                    testConnection(tokens.access_token);

                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(`
                        <html>
                            <head><title>Nest Authorization Complete</title></head>
                            <body style="font-family: Arial; padding: 40px; text-align: center;">
                                <h1 style="color: green;">✓ Authorization Successful!</h1>
                                <p>You can close this window and return to the terminal.</p>
                                <p>Your Nest thermostat is now connected to Home Monitor!</p>
                            </body>
                        </html>
                    `);

                    setTimeout(() => {
                        server.close();
                        console.log('Authorization complete! Server closed.\n');
                    }, 2000);

                } catch (err) {
                    console.error('✗ Error parsing token response:', err);
                    res.writeHead(500, { 'Content-Type': 'text/html' });
                    res.end('<h1>Error parsing response</h1>');
                    server.close();
                }
            });
        });

        tokenReq.on('error', (err) => {
            console.error('✗ Token request failed:', err);
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end('<h1>Error: ' + err.message + '</h1>');
            server.close();
        });

        tokenReq.write(tokenData);
        tokenReq.end();
    } else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>');
    }
});

function testConnection(accessToken) {
    console.log('Testing connection to Nest API...\n');

    const options = {
        hostname: 'smartdevicemanagement.googleapis.com',
        port: 443,
        path: '/v1/enterprises/' + PROJECT_ID + '/devices',
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + accessToken
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const devices = JSON.parse(data);

                if (devices.error) {
                    console.error('✗ API Error:', devices.error.message);
                    return;
                }

                if (devices.devices && devices.devices.length > 0) {
                    console.log('✓ Found', devices.devices.length, 'Nest device(s):\n');
                    devices.devices.forEach((device, i) => {
                        console.log(`Device ${i + 1}:`);
                        console.log('  Name:', device.traits['sdm.devices.traits.Info']?.customName || 'Unnamed');
                        console.log('  Type:', device.type);

                        // Show temperature if it's a thermostat
                        const tempTrait = device.traits['sdm.devices.traits.Temperature'];
                        if (tempTrait) {
                            const tempC = tempTrait.ambientTemperatureCelsius;
                            console.log('  Temperature:', tempC.toFixed(1) + '°C');
                        }
                        console.log('');
                    });
                } else {
                    console.log('⚠ No devices found. Make sure your Nest is linked to your Google account.');
                }
            } catch (err) {
                console.error('✗ Error parsing devices:', err);
            }
        });
    });

    req.on('error', (err) => {
        console.error('✗ API request failed:', err);
    });

    req.end();
}

server.listen(8080, () => {
    console.log('✓ Server ready at http://localhost:8080\n');
    console.log('Waiting for authorization...\n');
});

// Auto-open browser on Windows
const { exec } = require('child_process');
exec(`start ${authUrl}`);
