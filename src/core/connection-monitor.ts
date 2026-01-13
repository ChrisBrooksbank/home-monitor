/**
 * Connection Monitor Module
 * Handles health checks and reconnection logic for all services
 */

import type { AppConfig, ConnectionStatus, ConnectionsState, HueConfig } from '../types';
import { Logger } from '../utils/logger';
import { AppEvents } from './events';

declare const APP_CONFIG: AppConfig;
declare const window: Window & {
  HUE_CONFIG?: HueConfig;
};

export interface FullConnectionStatus extends ConnectionStatus {
  name?: string | null;
  apiVersion?: string | null;
  uptime?: number | null;
}

const connectionStatus: ConnectionsState = {
  hue: { online: false, lastCheck: null, name: null, apiVersion: null },
  sonos: { online: false, lastCheck: null, uptime: null },
  tapo: { online: false, lastCheck: null, uptime: null },
  shield: { online: false, lastCheck: null, uptime: null },
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
  const BRIDGE_IP = window.HUE_CONFIG?.BRIDGE_IP ?? '192.168.68.51';

  updateIndicator('status-hue', 'checking');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      APP_CONFIG.timeouts.proxyCheck
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
        };
        updateIndicator(
          'status-hue',
          'online',
          `Hue Bridge: ${data.name} (API v${data.apiversion})`
        );

        if (wasOffline) {
          AppEvents.emit('connection:hue:online', {
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
  connectionStatus.hue = {
    online: false,
    lastCheck: new Date(),
    name: null,
    apiVersion: null,
  };
  updateIndicator(
    'status-hue',
    'offline',
    `Hue Bridge: Offline - check connection to ${BRIDGE_IP}`
  );

  if (wasOnline) {
    AppEvents.emit('connection:hue:offline', {
      bridgeIp: BRIDGE_IP,
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
  updateIndicator(`status-${proxyName}`, 'checking');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      APP_CONFIG.timeouts.proxyCheck
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
      };
      updateIndicator(
        `status-${proxyName}`,
        'online',
        `${proxyName}: Online (uptime: ${formatUptime(data.uptime)})`
      );

      if (wasOffline) {
        AppEvents.emit('connection:proxy:online', {
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
  connectionStatus[proxyName] = {
    online: false,
    lastCheck: new Date(),
    uptime: null,
  };
  updateIndicator(
    `status-${proxyName}`,
    'offline',
    `${proxyName}: Offline - run 'npm start' to start proxies`
  );

  if (wasOnline) {
    AppEvents.emit('connection:proxy:offline', { proxy: proxyName });
  }
  return false;
}

/**
 * Check all connections in parallel
 */
async function checkAllConnections(): Promise<ConnectionsState> {
  if (isCheckingConnections) {
    Logger.warn('Connection check already in progress, skipping...');
    return connectionStatus;
  }

  isCheckingConnections = true;
  try {
    await Promise.all([
      checkHueBridgeHealth(),
      checkProxyHealth('sonos', APP_CONFIG.proxies.sonos),
      checkProxyHealth('tapo', APP_CONFIG.proxies.tapo),
      checkProxyHealth('shield', APP_CONFIG.proxies.shield),
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

    const allOnline = Object.values(connectionStatus).every((s) => s.online);
    const onlineCount = Object.values(connectionStatus).filter((s) => s.online).length;
    const totalCount = Object.keys(connectionStatus).length;

    Logger.info(
      `Connection check ${attempt}/${maxAttempts}: ${onlineCount}/${totalCount} services online`
    );

    if (allOnline) {
      Logger.success('All services are online!');
      return connectionStatus;
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, retryInterval));
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

export const ConnectionMonitor = {
  checkAll: checkAllConnections,
  checkHue: checkHueBridgeHealth,
  checkProxy: checkProxyHealth,
  waitForConnections,
  isOnline,
  getStatus,
  formatUptime,
} as const;

// Expose on window for global access
if (typeof window !== 'undefined') {
  window.ConnectionMonitor = ConnectionMonitor;
  // Legacy alias
  (window as unknown as Record<string, unknown>).checkAllConnections = checkAllConnections;
}
