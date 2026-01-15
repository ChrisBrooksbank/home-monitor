// Nest OAuth Proxy - Handles Google Nest OAuth token exchange
// This proxy is needed because Google's token endpoint doesn't support CORS
import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import https from 'https';
import type { RequestOptions } from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const PORT = 3003;

// ========================================
// TYPES
// ========================================

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

// ========================================
// CONFIGURATION
// ========================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, '..', '..', 'nest-config.json');
const jsConfigPath = path.join(__dirname, '..', '..', 'nest-config.js');

// Redirect URI for this proxy
const REDIRECT_URI = `http://localhost:${PORT}/auth/callback`;

/**
 * Load config from nest-config.json
 */
function loadConfig(): NestConfigFile | null {
    try {
        const configContent = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configContent) as NestConfigFile;
    } catch {
        return null;
    }
}

// ========================================
// TOKEN EXCHANGE
// ========================================

/**
 * Exchange authorization code for tokens
 */
function exchangeCodeForTokens(code: string, config: NestConfigFile): Promise<TokenResponse> {
    return new Promise((resolve, reject) => {
        const tokenData = new URLSearchParams({
            client_id: config.CLIENT_ID,
            client_secret: config.CLIENT_SECRET,
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
function saveTokens(tokens: TokenResponse, config: NestConfigFile): void {
    const newConfig: NestConfigFile = {
        CLIENT_ID: config.CLIENT_ID,
        CLIENT_SECRET: config.CLIENT_SECRET,
        PROJECT_ID: config.PROJECT_ID,
        REDIRECT_URI: REDIRECT_URI,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || config.refresh_token, // Keep existing refresh token if not provided
        expires_at: Date.now() + (tokens.expires_in || 3600) * 1000,
    };

    // Save JSON config
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));

    // Save JS config for browser
    const jsContent =
        'const NEST_CONFIG = ' +
        JSON.stringify(newConfig, null, 2) +
        ';\nwindow.NEST_CONFIG = NEST_CONFIG;\n';
    fs.writeFileSync(jsConfigPath, jsContent);

    console.log('Tokens saved to nest-config.json and nest-config.js');
}

/**
 * Generate OAuth authorization URL
 */
function getAuthUrl(config: NestConfigFile): string {
    return (
        `https://nestservices.google.com/partnerconnections/${config.PROJECT_ID}/auth?` +
        `redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&access_type=offline&prompt=consent` +
        `&client_id=${encodeURIComponent(config.CLIENT_ID)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent('https://www.googleapis.com/auth/sdm.service')}`
    );
}

// ========================================
// FASTIFY SERVER
// ========================================

let app: FastifyInstance | null = null;

function createApp(): FastifyInstance {
    const fastify = Fastify({ logger: false });

    // Register CORS
    fastify.register(cors, {
        origin: [/^http:\/\/localhost:\d+$/],
        methods: ['GET', 'HEAD', 'OPTIONS'],
    });

    // Health check
    fastify.get('/health', async () => {
        const config = loadConfig();
        const hasTokens = !!(config?.access_token && config?.refresh_token);
        const tokenExpired = config?.expires_at ? Date.now() > config.expires_at : true;

        return {
            status: 'ok',
            service: 'nest-proxy',
            uptime: process.uptime(),
            configured: !!config?.CLIENT_ID,
            hasTokens,
            tokenExpired: hasTokens ? tokenExpired : null,
            timestamp: new Date().toISOString(),
        };
    });

    // Get auth URL for browser to open
    fastify.get('/auth/url', async (_request: FastifyRequest, reply: FastifyReply) => {
        const config = loadConfig();
        if (!config?.CLIENT_ID || !config?.PROJECT_ID) {
            return reply.code(400).send({
                error: 'Nest not configured',
                message: 'nest-config.json is missing or incomplete',
            });
        }

        return {
            url: getAuthUrl(config),
        };
    });

    // Auth status check
    fastify.get('/auth/status', async () => {
        const config = loadConfig();

        if (!config?.CLIENT_ID) {
            return { configured: false, hasTokens: false, valid: false };
        }

        const hasTokens = !!(config.access_token && config.refresh_token);
        const tokenExpired = config.expires_at ? Date.now() > config.expires_at : true;

        return {
            configured: true,
            hasTokens,
            valid: hasTokens && !tokenExpired,
            expiresAt: config.expires_at ? new Date(config.expires_at).toISOString() : null,
        };
    });

    // OAuth callback handler
    fastify.get('/auth/callback', async (request: FastifyRequest, reply: FastifyReply) => {
        const { code, error } = request.query as { code?: string; error?: string };

        // Handle OAuth error
        if (error) {
            console.error('OAuth error:', error);
            return reply.type('text/html').send(`
                <!DOCTYPE html>
                <html>
                <head><title>Nest Auth Failed</title></head>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                    <h1 style="color: #d32f2f;">Authorization Failed</h1>
                    <p>Error: ${error}</p>
                    <p>Please close this window and try again.</p>
                </body>
                </html>
            `);
        }

        // Check for code
        if (!code) {
            return reply.code(400).type('text/html').send(`
                <!DOCTYPE html>
                <html>
                <head><title>Nest Auth Error</title></head>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                    <h1 style="color: #d32f2f;">No Authorization Code</h1>
                    <p>No code was received from Google.</p>
                    <p>Please close this window and try again.</p>
                </body>
                </html>
            `);
        }

        // Load config
        const config = loadConfig();
        if (!config) {
            return reply.code(500).type('text/html').send(`
                <!DOCTYPE html>
                <html>
                <head><title>Nest Auth Error</title></head>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                    <h1 style="color: #d32f2f;">Configuration Error</h1>
                    <p>Could not load nest-config.json</p>
                </body>
                </html>
            `);
        }

        console.log('Received authorization code, exchanging for tokens...');

        try {
            const tokens = await exchangeCodeForTokens(code, config);

            if (tokens.error) {
                console.error('Token exchange failed:', tokens.error, tokens.error_description);
                return reply.type('text/html').send(`
                    <!DOCTYPE html>
                    <html>
                    <head><title>Nest Auth Failed</title></head>
                    <body style="font-family: system-ui; padding: 40px; text-align: center;">
                        <h1 style="color: #d32f2f;">Token Exchange Failed</h1>
                        <p>${tokens.error}: ${tokens.error_description || 'Unknown error'}</p>
                        <p>Please close this window and try again.</p>
                    </body>
                    </html>
                `);
            }

            console.log('Got tokens! Saving...');
            saveTokens(tokens, config);

            return reply.type('text/html').send(`
                <!DOCTYPE html>
                <html>
                <head><title>Nest Auth Success</title></head>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                    <h1 style="color: #4caf50;">Success!</h1>
                    <p>Nest has been authorized successfully.</p>
                    <p>You can close this window and refresh the Home Monitor.</p>
                    <script>
                        // Try to close automatically after a delay
                        setTimeout(() => window.close(), 3000);
                    </script>
                </body>
                </html>
            `);
        } catch (err) {
            const error = err as Error;
            console.error('Token exchange error:', error.message);
            return reply.code(500).type('text/html').send(`
                <!DOCTYPE html>
                <html>
                <head><title>Nest Auth Error</title></head>
                <body style="font-family: system-ui; padding: 40px; text-align: center;">
                    <h1 style="color: #d32f2f;">Error</h1>
                    <p>${error.message}</p>
                    <p>Please close this window and try again.</p>
                </body>
                </html>
            `);
        }
    });

    return fastify;
}

// ========================================
// START SERVER
// ========================================

async function startServer(): Promise<void> {
    console.log('Starting Nest OAuth Proxy...\n');

    const config = loadConfig();
    if (config?.CLIENT_ID) {
        console.log(`Configured for project: ${config.PROJECT_ID}`);
        console.log(`Redirect URI: ${REDIRECT_URI}`);
    } else {
        console.log('Warning: nest-config.json not found or incomplete');
    }

    app = createApp();

    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`\nNest OAuth Proxy running on http://localhost:${PORT}`);
        console.log(`\nEndpoints:`);
        console.log(`   GET  /health        - Health check`);
        console.log(`   GET  /auth/url      - Get OAuth URL to open`);
        console.log(`   GET  /auth/status   - Check token status`);
        console.log(`   GET  /auth/callback - OAuth callback (used by Google)`);
        console.log(`\nReady!`);
    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
}

// Only start server when run directly
if (!process.env.VITEST) {
    startServer();
}

// ========================================
// EXPORTS
// ========================================

export { loadConfig, exchangeCodeForTokens, saveTokens, getAuthUrl, createApp, app };
