#!/usr/bin/env node
// Startup script - waits for proxies before launching Vite

import { spawn } from 'child_process';
import http from 'http';

const PROXIES = [
    { name: 'sonos', port: 3000, script: 'proxies/sonos-proxy.js', color: '\x1b[32m' },
    { name: 'tapo', port: 3001, script: 'proxies/tapo-proxy.js', color: '\x1b[33m' },
    { name: 'shield', port: 8082, script: 'proxies/shield-proxy.js', color: '\x1b[35m' },
    { name: 'news', port: 3002, script: 'proxies/news-proxy.js', color: '\x1b[34m' }
];

const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';

function checkHealth(port, timeout = 2000) {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/health`, { timeout }, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
    });
}

async function waitForProxy(proxy, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        if (await checkHealth(proxy.port)) {
            return true;
        }
        await new Promise(r => setTimeout(r, 500));
    }
    return false;
}

function startProxy(proxy) {
    const proc = spawn('node', [proxy.script], {
        stdio: ['ignore', 'pipe', 'pipe']
    });

    proc.stdout.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                console.log(`${proxy.color}[${proxy.name}]${RESET} ${line}`);
            }
        });
    });

    proc.stderr.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
            if (line.trim() && !line.includes('dotenv')) {
                console.log(`${proxy.color}[${proxy.name}]${RESET} ${line}`);
            }
        });
    });

    return proc;
}

function startVite() {
    // Use shell: true for cross-platform compatibility (args are hardcoded, so safe)
    const vite = spawn('npx', ['vite'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
    });

    vite.stdout.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                console.log(`${CYAN}[vite]${RESET} ${line}`);
            }
        });
    });

    vite.stderr.on('data', (data) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                console.log(`${CYAN}[vite]${RESET} ${line}`);
            }
        });
    });

    return vite;
}

async function main() {
    console.log(`\n${GREEN}Starting Home Monitor...${RESET}\n`);

    // Start all proxies
    const processes = PROXIES.map(proxy => {
        console.log(`${proxy.color}[${proxy.name}]${RESET} Starting on port ${proxy.port}...`);
        return { proxy, proc: startProxy(proxy) };
    });

    // Wait for all proxies to be healthy
    console.log(`\n${YELLOW}Waiting for proxies to be ready...${RESET}\n`);

    const results = await Promise.all(
        PROXIES.map(async (proxy) => {
            const ready = await waitForProxy(proxy);
            if (ready) {
                console.log(`${GREEN}✓${RESET} ${proxy.name} proxy ready`);
            } else {
                console.log(`${YELLOW}⚠${RESET} ${proxy.name} proxy not responding (continuing anyway)`);
            }
            return ready;
        })
    );

    const allReady = results.every(r => r);
    console.log('');

    if (allReady) {
        console.log(`${GREEN}All proxies ready!${RESET}\n`);
    }

    // Start Vite
    console.log(`${CYAN}[vite]${RESET} Starting dev server...\n`);
    const vite = startVite();

    // Handle shutdown
    const cleanup = () => {
        console.log(`\n${YELLOW}Shutting down...${RESET}`);
        processes.forEach(({ proc }) => proc.kill());
        vite.kill();
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

main().catch(console.error);
