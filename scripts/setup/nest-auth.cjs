// Google Nest OAuth Authorization Flow (CommonJS version)
const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

// Load credentials from nest-config.json
const configPath = path.join(__dirname, '..', '..', 'nest-config.json');
let config;

try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('Loaded credentials from nest-config.json');
} catch (err) {
    console.error('Could not load nest-config.json:', err.message);
    process.exit(1);
}

const { CLIENT_ID, CLIENT_SECRET, PROJECT_ID } = config;
const REDIRECT_URI = config.REDIRECT_URI || 'http://localhost:8080/auth/callback';

console.log('\n=== Google Nest Authorization ===\n');

const authUrl = 'https://nestservices.google.com/partnerconnections/' + PROJECT_ID + '/auth?' +
    'redirect_uri=' + encodeURIComponent(REDIRECT_URI) +
    '&access_type=offline&prompt=consent' +
    '&client_id=' + encodeURIComponent(CLIENT_ID) +
    '&response_type=code' +
    '&scope=' + encodeURIComponent('https://www.googleapis.com/auth/sdm.service');

console.log('Open this URL in your browser:\n');
console.log(authUrl);
console.log('\nStarting local server on http://localhost:8080...\n');

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    if (parsedUrl.pathname === '/auth/callback') {
        const code = parsedUrl.query.code;
        if (!code) {
            res.writeHead(400);
            res.end('No code received');
            return;
        }
        console.log('Received authorization code, exchanging for tokens...');

        const tokenData = new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI
        }).toString();

        const tokenReq = https.request({
            hostname: 'www.googleapis.com',
            port: 443,
            path: '/oauth2/v4/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': tokenData.length
            }
        }, (tokenRes) => {
            let data = '';
            tokenRes.on('data', chunk => data += chunk);
            tokenRes.on('end', () => {
                const tokens = JSON.parse(data);
                if (tokens.error) {
                    console.error('Token exchange failed:', tokens.error);
                    res.writeHead(500);
                    res.end('Error: ' + tokens.error);
                    server.close();
                    return;
                }

                console.log('Got tokens! Saving...');
                const newConfig = {
                    CLIENT_ID, CLIENT_SECRET, PROJECT_ID, REDIRECT_URI,
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    expires_at: Date.now() + (tokens.expires_in * 1000)
                };

                fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
                const jsPath = path.join(__dirname, '..', '..', 'nest-config.js');
                fs.writeFileSync(jsPath, 'const NEST_CONFIG = ' + JSON.stringify(newConfig, null, 2) + ';\nwindow.NEST_CONFIG = NEST_CONFIG;\n');
                
                console.log('Tokens saved! You can now refresh your browser.');
                res.writeHead(200, {'Content-Type': 'text/html'});
                res.end('<h1>Success!</h1><p>Close this and refresh Home Monitor.</p>');
                setTimeout(() => { server.close(); process.exit(0); }, 2000);
            });
        });
        tokenReq.write(tokenData);
        tokenReq.end();
    }
});

server.listen(8080, () => {
    console.log('Server ready. Waiting for callback...\n');
    require('child_process').exec('start "" "' + authUrl + '"');
});
