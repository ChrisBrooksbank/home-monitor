/**
 * Tapo Smart Plug API Module
 * Handles communication with TP-Link Tapo smart plugs via proxy
 */

import type {
  AppConfig,
  TapoPlugsResponse,
  TapoStatusResponse,
  TapoToggleResponse,
} from '../types';
import { Logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/helpers';

declare const APP_CONFIG: AppConfig;

/**
 * Make a request to the Tapo proxy
 */
async function request<T>(endpoint: string, body: object = {}): Promise<T> {
  try {
    const response = await fetch(`${APP_CONFIG.proxies.tapo}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(APP_CONFIG.timeouts.apiRequest),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error(`Tapo API error (${endpoint}):`, message);
    throw error;
  }
}

/**
 * Turn plug ON
 */
async function turnOn(plugName: string): Promise<TapoToggleResponse> {
  Logger.info(`Turning ON Tapo plug: ${plugName}`);
  try {
    const result = await retryWithBackoff(() =>
      request<TapoToggleResponse>('/on', { plugName })
    );
    Logger.success(`${plugName} is now ON`);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error(`Failed to turn on ${plugName}:`, message);
    throw error;
  }
}

/**
 * Turn plug OFF
 */
async function turnOff(plugName: string): Promise<TapoToggleResponse> {
  Logger.info(`Turning OFF Tapo plug: ${plugName}`);
  try {
    const result = await retryWithBackoff(() =>
      request<TapoToggleResponse>('/off', { plugName })
    );
    Logger.success(`${plugName} is now OFF`);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error(`Failed to turn off ${plugName}:`, message);
    throw error;
  }
}

/**
 * Get plug status
 */
async function getStatus(plugName: string): Promise<TapoStatusResponse | null> {
  try {
    return await request<TapoStatusResponse>('/status', { plugName });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error(`Failed to get status for ${plugName}:`, message);
    return null;
  }
}

/**
 * Toggle plug state
 */
async function toggle(plugName: string): Promise<TapoToggleResponse> {
  Logger.info(`Toggling Tapo plug: ${plugName}`);
  try {
    const status = await getStatus(plugName);
    const isOn = status?.state === 'on';

    if (isOn) {
      return await turnOff(plugName);
    } else {
      return await turnOn(plugName);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error(`Failed to toggle ${plugName}:`, message);
    throw error;
  }
}

/**
 * Get list of discovered plugs
 */
async function getPlugs(): Promise<TapoPlugsResponse> {
  try {
    const response = await fetch(`${APP_CONFIG.proxies.tapo}/plugs`, {
      method: 'GET',
      signal: AbortSignal.timeout(APP_CONFIG.timeouts.proxyCheck),
    });
    return (await response.json()) as TapoPlugsResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error('Failed to get Tapo plugs:', message);
    return { plugs: {}, count: 0 };
  }
}

interface TapoDiscoveryResponse {
  success: boolean;
  count: number;
  plugs: Record<string, unknown>;
}

/**
 * Trigger network discovery for Tapo plugs
 */
async function discover(): Promise<TapoDiscoveryResponse> {
  Logger.info('Starting Tapo plug discovery...');
  try {
    const response = await fetch(`${APP_CONFIG.proxies.tapo}/discover`, {
      method: 'POST',
      signal: AbortSignal.timeout(60000),
    });
    const result = (await response.json()) as TapoDiscoveryResponse;
    if (result.success) {
      Logger.success(`Discovered ${result.count} Tapo plugs`);
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error('Discovery failed:', message);
    throw error;
  }
}

/**
 * Check if Tapo proxy is available
 */
async function checkAvailability(): Promise<boolean> {
  try {
    const response = await fetch(`${APP_CONFIG.proxies.tapo}/plugs`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(APP_CONFIG.timeouts.proxyCheck),
    });
    if (response.ok) {
      Logger.success('Tapo proxy is available');
      return true;
    }
    Logger.warn('Tapo proxy not available - controls will be disabled');
    return false;
  } catch {
    Logger.warn('Tapo proxy not available - controls will be disabled');
    return false;
  }
}

export const TapoAPI = {
  proxyUrl: APP_CONFIG?.proxies?.tapo ?? 'http://localhost:3001',
  request,
  turnOn,
  turnOff,
  getStatus,
  toggle,
  getPlugs,
  discover,
  checkAvailability,
} as const;

// Expose on window for global access
if (typeof window !== 'undefined') {
  window.TapoAPI = TapoAPI;
}
