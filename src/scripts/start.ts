#!/usr/bin/env npx tsx
/**
 * Startup script - waits for proxies before launching Vite
 * Run with: npx tsx src/scripts/start.ts
 */

import { spawn, type ChildProcess } from 'child_process';
import http from 'http';

// =============================================================================
// TYPES
// =============================================================================

interface ProxyConfig {
    name: string;
    port: number;
    script: string;
    color: string;
}

interface ProxyProcess {
    proxy: ProxyConfig;
    proc: ChildProcess;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const PROXIES: ProxyConfig[] = [
    { name: 'sonos', port: 3000, script: 'src/proxies/sonos-proxy.ts', color: '\x1b[32m' },
    { name: 'tapo', port: 3001, script: 'src/proxies/tapo-proxy.ts', color: '\x1b[33m' },
    { name: 'shield', port: 8082, script: 'src/proxies/shield-proxy.ts', color: '\x1b[35m' },
    { name: 'news', port: 3002, script: 'src/proxies/news-proxy.ts', color: '\x1b[34m' },
];

const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';

// =============================================================================
// HEALTH CHECK UTILITIES
// =============================================================================

/**
 * Check if a proxy is healthy by hitting its /health endpoint
 */
function checkHealth(port: number, timeout = 2000): Promise<boolean> {
    return new Promise((resolve) => {
        const req = http.get(`http://localhost:${port}/health`, { timeout }, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
    });
}

/**
 * Wait for a proxy to become healthy
 */
async function waitForProxy(proxy: ProxyConfig, maxAttempts = 30): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
        if (await checkHealth(proxy.port)) {
            return true;
        }
        await new Promise((r) => setTimeout(r, 500));
    }
    return false;
}

// =============================================================================
// PROCESS MANAGEMENT
// =============================================================================

/**
 * Start a proxy server process
 */
function startProxy(proxy: ProxyConfig): ChildProcess {
    // Use npx tsx to run TypeScript files directly
    const proc = spawn('npx', ['tsx', proxy.script], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
    });

    proc.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach((line) => {
            if (line.trim()) {
                console.log(`${proxy.color}[${proxy.name}]${RESET} ${line}`);
            }
        });
    });

    proc.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach((line) => {
            if (line.trim() && !line.includes('dotenv')) {
                console.log(`${proxy.color}[${proxy.name}]${RESET} ${line}`);
            }
        });
    });

    return proc;
}

/**
 * Start the Vite dev server
 */
function startVite(): ChildProcess {
    // Use shell: true for cross-platform compatibility (args are hardcoded, so safe)
    const vite = spawn('npx', ['vite'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
    });

    vite.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach((line) => {
            if (line.trim()) {
                console.log(`${CYAN}[vite]${RESET} ${line}`);
            }
        });
    });

    vite.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().trim().split('\n');
        lines.forEach((line) => {
            if (line.trim()) {
                console.log(`${CYAN}[vite]${RESET} ${line}`);
            }
        });
    });

    return vite;
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
    console.log(`\n${GREEN}Starting Home Monitor...${RESET}\n`);

    // Start all proxies
    const processes: ProxyProcess[] = PROXIES.map((proxy) => {
        console.log(`${proxy.color}[${proxy.name}]${RESET} Starting on port ${proxy.port}...`);
        return { proxy, proc: startProxy(proxy) };
    });

    // Wait for all proxies to be healthy
    console.log(`\n${YELLOW}Waiting for proxies to be ready...${RESET}\n`);

    const results = await Promise.all(
        PROXIES.map(async (proxy) => {
            const ready = await waitForProxy(proxy);
            if (ready) {
                console.log(`${GREEN}[OK]${RESET} ${proxy.name} proxy ready`);
            } else {
                console.log(`${YELLOW}[WARN]${RESET} ${proxy.name} proxy not responding (continuing anyway)`);
            }
            return ready;
        })
    );

    const allReady = results.every((r) => r);
    console.log('');

    if (allReady) {
        console.log(`${GREEN}All proxies ready!${RESET}\n`);
    }

    // Start Vite
    console.log(`${CYAN}[vite]${RESET} Starting dev server...\n`);
    const vite = startVite();

    // Handle shutdown
    const cleanup = (): void => {
        console.log(`\n${YELLOW}Shutting down...${RESET}`);
        processes.forEach(({ proc }) => proc.kill());
        vite.kill();
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
}

main().catch(console.error);
