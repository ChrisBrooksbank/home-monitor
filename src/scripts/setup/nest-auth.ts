#!/usr/bin/env npx tsx
/**
 * Google Nest OAuth Authorization Flow
 * Run with: npx tsx src/scripts/setup/nest-auth.ts
 *
 * This script:
 * 1. Loads credentials from nest-config.json
 * 2. Opens a browser for Google OAuth login
 * 3. Exchanges the auth code for tokens
 * 4. Saves tokens to nest-config.json and nest-config.js
 */

import http, { type IncomingMessage, type ServerResponse } from 'http';
import https, { type RequestOptions } from 'https';
import { URL, URLSearchParams } from 'url';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

// =============================================================================
// TYPES
// =============================================================================

interface NestConfigFile {
    CLIENT_ID: string;
    CLIENT_SECRET: string;
    PROJECT_ID: string;
    REDIRECT_URI?: string;
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
}

interface TokenResponse {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, '..', '..', '..', 'nest-config.json');
let config: NestConfigFile;

try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(configContent) as NestConfigFile;
    console.log('Loaded credentials from nest-config.json');
} catch (err) {
    const error = err as Error;
    console.error('Could not load nest-config.json:', error.message);
    process.exit(1);
}

const { CLIENT_ID, CLIENT_SECRET, PROJECT_ID } = config;
const REDIRECT_URI = config.REDIRECT_URI || 'http://localhost:8080/auth/callback';

// =============================================================================
// AUTH URL GENERATION
// =============================================================================

console.log('\n=== Google Nest Authorization ===\n');

const authUrl =
    `https://nestservices.google.com/partnerconnections/${PROJECT_ID}/auth?` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&access_type=offline&prompt=consent` +
    `&client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent('https://www.googleapis.com/auth/sdm.service')}`;

console.log('Open this URL in your browser:\n');
console.log(authUrl);
console.log('\nStarting local server on http://localhost:8080...\n');

// =============================================================================
// TOKEN EXCHANGE
// =============================================================================

/**
 * Exchange authorization code for tokens
 */
function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
    return new Promise((resolve, reject) => {
        const tokenData = new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
        }).toString();

        const options: RequestOptions = {
            hostname: 'www.googleapis.com',
            port: 443,
            path: '/oauth2/v4/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': tokenData.length,
            },
        };

        const tokenReq = https.request(options, (tokenRes) => {
            let data = '';
            tokenRes.on('data', (chunk: Buffer) => (data += chunk));
            tokenRes.on('end', () => {
                try {
                    const tokens = JSON.parse(data) as TokenResponse;
                    resolve(tokens);
                } catch {
                    reject(new Error('Failed to parse token response'));
                }
            });
        });

        tokenReq.on('error', reject);
        tokenReq.write(tokenData);
        tokenReq.end();
    });
}

/**
 * Save tokens to config files
 */
function saveTokens(tokens: TokenResponse): void {
    const newConfig: NestConfigFile = {
        CLIENT_ID,
        CLIENT_SECRET,
        PROJECT_ID,
        REDIRECT_URI,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
    };

    // Save JSON config
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));

    // Save JS config for browser
    const jsPath = path.join(__dirname, '..', '..', '..', 'nest-config.js');
    const jsContent =
        'const NEST_CONFIG = ' +
        JSON.stringify(newConfig, null, 2) +
        ';\nwindow.NEST_CONFIG = NEST_CONFIG;\n';
    fs.writeFileSync(jsPath, jsContent);

    console.log('Tokens saved to nest-config.json and nest-config.js');
}

// =============================================================================
// HTTP SERVER
// =============================================================================

const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const parsedUrl = new URL(req.url || '/', `http://localhost:8080`);

    if (parsedUrl.pathname === '/auth/callback') {
        const code = parsedUrl.searchParams.get('code');

        if (!code) {
            res.writeHead(400);
            res.end('No code received');
            return;
        }

        console.log('Received authorization code, exchanging for tokens...');

        try {
            const tokens = await exchangeCodeForTokens(code);

            if (tokens.error) {
                console.error('Token exchange failed:', tokens.error);
                res.writeHead(500);
                res.end(`Error: ${tokens.error}`);
                server.close();
                return;
            }

            console.log('Got tokens! Saving...');
            saveTokens(tokens);

            console.log('Tokens saved! You can now refresh your browser.');
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Success!</h1><p>Close this and refresh Home Monitor.</p>');

            setTimeout(() => {
                server.close();
                process.exit(0);
            }, 2000);
        } catch (err) {
            const error = err as Error;
            console.error('Token exchange error:', error.message);
            res.writeHead(500);
            res.end(`Error: ${error.message}`);
            server.close();
        }
    }
});

server.listen(8080, () => {
    console.log('Server ready. Waiting for callback...\n');
    // Open browser (Windows)
    exec(`start "" "${authUrl}"`);
});
