/**
 * Connection Monitor Module
 * Handles health checks and reconnection logic for all services
 */

import type { ConnectionStatus, ConnectionsState } from '../types';
import { Logger, getAppConfig, getAppEvents, getHueConfig } from '../utils';
import { Registry } from './registry';
import { getNestConfigWithFallback } from '../config/config-bridge';

interface FullConnectionStatus extends ConnectionStatus {
    name?: string | null;
    apiVersion?: string | null;
    uptime?: number | null;
}

const connectionStatus: ConnectionsState = {
    hue: { online: false, lastCheck: null, name: null, apiVersion: null, error: null },
    sonos: { online: false, lastCheck: null, uptime: null, error: null },
    tapo: { online: false, lastCheck: null, uptime: null, error: null },
    shield: { online: false, lastCheck: null, uptime: null, error: null },
    nest: { online: false, lastCheck: null, error: null },
};

let isCheckingConnections = false;

/**
 * Format uptime seconds into human-readable string
 */
function formatUptime(seconds: number | null | undefined): string {
    if (!seconds) return 'unknown';
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
}

/**
 * Update a status indicator element
 */
function updateIndicator(
    id: string,
    state: 'checking' | 'online' | 'offline',
    title?: string
): void {
    const indicator = document.getElementById(id);
    if (!indicator) return;

    indicator.classList.remove('online', 'offline', 'checking');
    indicator.classList.add(state);
    if (title) indicator.title = title;
}

interface HueBridgeConfigResponse {
    bridgeid?: string;
    name?: string;
    apiversion?: string;
}

/**
 * Check Hue bridge connectivity
 */
async function checkHueBridgeHealth(): Promise<boolean> {
    const hueConfig = getHueConfig();
    const appConfig = getAppConfig();
    const BRIDGE_IP = hueConfig?.BRIDGE_IP ?? '192.168.68.51';

    updateIndicator('status-hue', 'checking');

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
            () => controller.abort(),
            appConfig?.timeouts?.proxyCheck ?? 2000
        );

        const response = await fetch(`http://${BRIDGE_IP}/api/config`, {
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = (await response.json()) as HueBridgeConfigResponse;
            if (data.bridgeid) {
                const wasOffline = !connectionStatus.hue.online;
                connectionStatus.hue = {
                    online: true,
                    lastCheck: new Date(),
                    name: data.name ?? null,
                    apiVersion: data.apiversion ?? null,
                    error: null,
                };
                updateIndicator(
                    'status-hue',
                    'online',
                    `Hue Bridge: ${data.name} (API v${data.apiversion})`
                );

                if (wasOffline) {
                    const events = getAppEvents();
                    events?.emit('connection:hue:online', {
                        name: data.name ?? 'Hue Bridge',
                        apiVersion: data.apiversion ?? 'unknown',
                    });
                }
                return true;
            }
        }
    } catch {
        // Bridge is offline or unreachable
    }

    const wasOnline = connectionStatus.hue.online;
    const errorMsg = `Check connection to ${BRIDGE_IP}`;
    connectionStatus.hue = {
        online: false,
        lastCheck: new Date(),
        name: null,
        apiVersion: null,
        error: errorMsg,
    };
    updateIndicator('status-hue', 'offline', `Hue Bridge: Offline - ${errorMsg}`);

    if (wasOnline) {
        const events = getAppEvents();
        events?.emit('connection:hue:offline', {
            bridgeIp: BRIDGE_IP,
            error: errorMsg,
        });
    }
    return false;
}

interface ProxyHealthResponse {
    uptime?: number;
}

/**
 * Check proxy server health
 */
async function checkProxyHealth(
    proxyName: 'sonos' | 'tapo' | 'shield',
    url: string
): Promise<boolean> {
    const appConfig = getAppConfig();
    updateIndicator(`status-${proxyName}`, 'checking');

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
            () => controller.abort(),
            appConfig?.timeouts?.proxyCheck ?? 2000
        );

        const response = await fetch(`${url}/health`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = (await response.json()) as ProxyHealthResponse;
            const wasOffline = !connectionStatus[proxyName].online;
            connectionStatus[proxyName] = {
                online: true,
                lastCheck: new Date(),
                uptime: data.uptime ?? null,
                error: null,
            };
            updateIndicator(
                `status-${proxyName}`,
                'online',
                `${proxyName}: Online (uptime: ${formatUptime(data.uptime)})`
            );

            if (wasOffline) {
                const events = getAppEvents();
                events?.emit('connection:proxy:online', {
                    proxy: proxyName,
                    uptime: data.uptime,
                });
            }
            return true;
        }
    } catch {
        // Proxy is offline or unreachable
    }

    const wasOnline = connectionStatus[proxyName].online;
    const errorMsg = "Run 'npm start' to start proxies";
    connectionStatus[proxyName] = {
        online: false,
        lastCheck: new Date(),
        uptime: null,
        error: errorMsg,
    };
    updateIndicator(`status-${proxyName}`, 'offline', `${proxyName}: Offline - ${errorMsg}`);

    if (wasOnline) {
        const events = getAppEvents();
        events?.emit('connection:proxy:offline', { proxy: proxyName, error: errorMsg });
    }
    return false;
}

/**
 * Check Nest thermostat config and token validity
 * Does NOT make API calls - just validates config/token state
 */
function checkNestHealth(): boolean {
    updateIndicator('status-nest', 'checking');

    const config = getNestConfigWithFallback();

    // Check if config exists
    if (!config) {
        const errorMsg = "Run 'npx tsx src/scripts/setup/nest-auth.ts' to configure";
        const wasOnline = connectionStatus.nest.online;
        connectionStatus.nest = {
            online: false,
            lastCheck: new Date(),
            error: errorMsg,
        };
        updateIndicator('status-nest', 'offline', `Nest: ${errorMsg}`);

        if (wasOnline) {
            const events = getAppEvents();
            events?.emit('connection:nest:offline', { error: errorMsg });
        }
        return false;
    }

    // Get access token (handle both camelCase and UPPER_CASE)
    const accessToken = config.access_token ?? config.ACCESS_TOKEN;
    if (!accessToken) {
        const errorMsg = 'Access token missing - re-run auth setup';
        const wasOnline = connectionStatus.nest.online;
        connectionStatus.nest = {
            online: false,
            lastCheck: new Date(),
            error: errorMsg,
        };
        updateIndicator('status-nest', 'offline', `Nest: ${errorMsg}`);

        if (wasOnline) {
            const events = getAppEvents();
            events?.emit('connection:nest:offline', { error: errorMsg });
        }
        return false;
    }

    // Check token expiry (handle both camelCase and UPPER_CASE)
    const expiresAt = config.expires_at ?? config.EXPIRES_AT;
    if (expiresAt && Date.now() > expiresAt) {
        const errorMsg = 'Token expired - run auth refresh';
        const wasOnline = connectionStatus.nest.online;
        connectionStatus.nest = {
            online: false,
            lastCheck: new Date(),
            error: errorMsg,
        };
        updateIndicator('status-nest', 'offline', `Nest: ${errorMsg}`);

        if (wasOnline) {
            const events = getAppEvents();
            events?.emit('connection:nest:offline', { error: errorMsg });
        }
        return false;
    }

    // Config and token are valid
    const wasOffline = !connectionStatus.nest.online;
    connectionStatus.nest = {
        online: true,
        lastCheck: new Date(),
        error: null,
    };
    updateIndicator('status-nest', 'online', 'Nest: Configured');

    if (wasOffline) {
        const events = getAppEvents();
        events?.emit('connection:nest:online', {});
    }
    return true;
}

/**
 * Check all connections in parallel
 */
async function checkAllConnections(): Promise<ConnectionsState> {
    if (isCheckingConnections) {
        Logger.warn('Connection check already in progress, skipping...');
        return connectionStatus;
    }

    const appConfig = getAppConfig();
    isCheckingConnections = true;
    try {
        // Check Nest synchronously (no network call)
        checkNestHealth();

        // Check others in parallel (network calls)
        await Promise.all([
            checkHueBridgeHealth(),
            checkProxyHealth('sonos', appConfig?.proxies?.sonos ?? 'http://localhost:3000'),
            checkProxyHealth('tapo', appConfig?.proxies?.tapo ?? 'http://localhost:3001'),
            checkProxyHealth('shield', appConfig?.proxies?.shield ?? 'http://localhost:8082'),
        ]);
    } finally {
        isCheckingConnections = false;
    }

    return connectionStatus;
}

/**
 * Check if a specific service is online
 */
function isOnline(service: keyof ConnectionsState): boolean {
    return connectionStatus[service]?.online ?? false;
}

/**
 * Get the current connection status for all services
 */
function getStatus(): ConnectionsState {
    return { ...connectionStatus };
}

interface WaitOptions {
    maxAttempts?: number;
    retryInterval?: number;
    timeout?: number;
}

/**
 * Wait for all connections to come online with rapid retries
 */
async function waitForConnections(options: WaitOptions = {}): Promise<ConnectionsState> {
    const maxAttempts = options.maxAttempts ?? 10;
    const retryInterval = options.retryInterval ?? 2000;
    const timeout = options.timeout ?? 30000;
    const startTime = Date.now();

    Logger.info('Waiting for services to come online...');

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        if (Date.now() - startTime > timeout) {
            Logger.warn(`Connection wait timed out after ${timeout}ms`);
            break;
        }

        await checkAllConnections();

        const allOnline = Object.values(connectionStatus).every(s => s.online);
        const onlineCount = Object.values(connectionStatus).filter(s => s.online).length;
        const totalCount = Object.keys(connectionStatus).length;

        Logger.info(
            `Connection check ${attempt}/${maxAttempts}: ${onlineCount}/${totalCount} services online`
        );

        if (allOnline) {
            Logger.success('All services are online!');
            return connectionStatus;
        }

        if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, retryInterval));
        }
    }

    const offline = Object.entries(connectionStatus)
        .filter(([, status]) => !status.online)
        .map(([name]) => name);

    if (offline.length > 0) {
        Logger.warn(`Services still offline: ${offline.join(', ')}`);
    }

    return connectionStatus;
}

/**
 * Get the error message for a service, if any
 */
function getErrorMessage(service: keyof ConnectionsState): string | null {
    return connectionStatus[service]?.error ?? null;
}

export const ConnectionMonitor = {
    checkAll: checkAllConnections,
    checkHue: checkHueBridgeHealth,
    checkProxy: checkProxyHealth,
    checkNest: checkNestHealth,
    waitForConnections,
    isOnline,
    getStatus,
    getErrorMessage,
    formatUptime,
} as const;

// Register with the service registry
Registry.register({
    key: 'ConnectionMonitor',
    instance: ConnectionMonitor,
});
