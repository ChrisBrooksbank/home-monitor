/**
 * Tapo Smart Plug API Module
 * Handles communication with TP-Link Tapo smart plugs via proxy
 */

import type {
  TapoPlugsResponse,
  TapoStatusResponse,
  TapoToggleResponse,
} from '../types';
import { Logger, retryWithBackoff, getAppConfig } from '../utils';
import { Registry } from '../core/registry';

/**
 * Make a request to the Tapo proxy
 */
async function request<T>(endpoint: string, body: object = {}): Promise<T> {
  const config = getAppConfig();
  try {
    const response = await fetch(`${config?.proxies?.tapo ?? 'http://localhost:3001'}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config?.timeouts?.apiRequest ?? 10000),
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
  const config = getAppConfig();
  try {
    const response = await fetch(`${config?.proxies?.tapo ?? 'http://localhost:3001'}/plugs`, {
      method: 'GET',
      signal: AbortSignal.timeout(config?.timeouts?.proxyCheck ?? 2000),
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
  const config = getAppConfig();
  Logger.info('Starting Tapo plug discovery...');
  try {
    const response = await fetch(`${config?.proxies?.tapo ?? 'http://localhost:3001'}/discover`, {
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
  const config = getAppConfig();
  try {
    const response = await fetch(`${config?.proxies?.tapo ?? 'http://localhost:3001'}/plugs`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(config?.timeouts?.proxyCheck ?? 2000),
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
  get proxyUrl() {
    return getAppConfig()?.proxies?.tapo ?? 'http://localhost:3001';
  },
  request,
  turnOn,
  turnOff,
  getStatus,
  toggle,
  getPlugs,
  discover,
  checkAvailability,
} as const;

// Register with the service registry
Registry.register({
  key: 'TapoAPI',
  instance: TapoAPI,
});
