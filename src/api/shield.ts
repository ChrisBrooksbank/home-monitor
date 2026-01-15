/**
 * NVIDIA SHIELD API Module
 * Handles communication with NVIDIA SHIELD TV via proxy
 */

import { Logger, checkProxyAvailability, getAppConfig } from '../utils';
import { Registry } from '../core/registry';

// Helper to get proxy URL
function getProxyUrl(): string {
  return getAppConfig()?.proxies?.shield ?? 'http://localhost:8082';
}

// Helper to get timeout
function getTimeout(type: 'proxyCheck' | 'apiRequest'): number {
  const config = getAppConfig();
  if (type === 'proxyCheck') {
    return config?.timeouts?.proxyCheck ?? 3000;
  }
  return config?.timeouts?.apiRequest ?? 10000;
}

interface ShieldAppsResponse {
  apps: Array<{
    name: string;
    packageName: string;
    icon?: string;
  }>;
}

interface ShieldInfoResponse {
  deviceName: string;
  model: string;
  androidVersion: string;
  connected: boolean;
}

interface ShieldActionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Check if SHIELD proxy is available
 */
async function checkAvailability(): Promise<boolean> {
  return await checkProxyAvailability(
    `${getProxyUrl()}/health`,
    'SHIELD'
  );
}

/**
 * Get list of available apps
 */
async function getApps(): Promise<ShieldAppsResponse> {
  try {
    const response = await fetch(`${getProxyUrl()}/apps`, {
      method: 'GET',
      signal: AbortSignal.timeout(getTimeout('proxyCheck')),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as ShieldAppsResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error('Failed to get SHIELD apps:', message);
    return { apps: [] };
  }
}

/**
 * Get SHIELD device info
 */
async function getInfo(): Promise<ShieldInfoResponse | null> {
  try {
    const response = await fetch(`${getProxyUrl()}/info`, {
      method: 'GET',
      signal: AbortSignal.timeout(getTimeout('apiRequest')),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as ShieldInfoResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error('Failed to get SHIELD info:', message);
    return null;
  }
}

/**
 * Launch an app on the SHIELD
 */
async function launchApp(appName: string): Promise<ShieldActionResponse> {
  Logger.info(`Launching ${appName} on SHIELD...`);
  try {
    const response = await fetch(`${getProxyUrl()}/launch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Name': appName,
      },
      signal: AbortSignal.timeout(getTimeout('apiRequest')),
    });

    const result = (await response.json()) as ShieldActionResponse;

    if (!response.ok) {
      throw new Error(result.error ?? `HTTP ${response.status}`);
    }

    Logger.success(`${appName} launched on SHIELD`);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error(`Failed to launch ${appName}:`, message);
    throw error;
  }
}

/**
 * Stop current app / return to home screen
 */
async function stop(): Promise<ShieldActionResponse> {
  Logger.info('Stopping SHIELD app...');
  try {
    const response = await fetch(`${getProxyUrl()}/stop`, {
      method: 'POST',
      signal: AbortSignal.timeout(getTimeout('apiRequest')),
    });

    const result = (await response.json()) as ShieldActionResponse;

    if (!response.ok) {
      throw new Error(result.error ?? `HTTP ${response.status}`);
    }

    Logger.success('SHIELD returned to home screen');
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error('Failed to stop SHIELD app:', message);
    throw error;
  }
}

export const ShieldAPI = {
  get proxyUrl(): string {
    return getProxyUrl();
  },
  checkAvailability,
  getApps,
  getInfo,
  launchApp,
  stop,
} as const;

// Register with the service registry
Registry.register({
  key: 'ShieldAPI' as const,
  instance: ShieldAPI as unknown as typeof import('./shield').ShieldAPI,
});
