/**
 * NVIDIA SHIELD API Module
 * Handles communication with NVIDIA SHIELD TV via proxy
 */

import type { AppConfig } from '../types';
import { Logger } from '../utils/logger';
import { checkProxyAvailability } from '../utils/helpers';

declare const APP_CONFIG: AppConfig;

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
    `${APP_CONFIG.proxies.shield}/health`,
    'SHIELD'
  );
}

/**
 * Get list of available apps
 */
async function getApps(): Promise<ShieldAppsResponse> {
  try {
    const response = await fetch(`${APP_CONFIG.proxies.shield}/apps`, {
      method: 'GET',
      signal: AbortSignal.timeout(APP_CONFIG.timeouts.proxyCheck),
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
    const response = await fetch(`${APP_CONFIG.proxies.shield}/info`, {
      method: 'GET',
      signal: AbortSignal.timeout(APP_CONFIG.timeouts.apiRequest),
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
    const response = await fetch(`${APP_CONFIG.proxies.shield}/launch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Name': appName,
      },
      signal: AbortSignal.timeout(APP_CONFIG.timeouts.apiRequest),
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
    const response = await fetch(`${APP_CONFIG.proxies.shield}/stop`, {
      method: 'POST',
      signal: AbortSignal.timeout(APP_CONFIG.timeouts.apiRequest),
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
  proxyUrl: APP_CONFIG?.proxies?.shield ?? 'http://localhost:8082',
  checkAvailability,
  getApps,
  getInfo,
  launchApp,
  stop,
} as const;

// Expose on window for global access
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).ShieldAPI = ShieldAPI;
}
