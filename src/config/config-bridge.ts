/**
 * Config Bridge
 * Bridges external config.js values into the Registry
 *
 * config.js is loaded via script tag before the app and sets window globals.
 * This module copies those values into the Registry after they're available.
 */

import { Registry } from '../core/registry';
import type { HueConfig, WeatherConfig, NestConfig } from '../types';

// Declare window properties that may be set by external config.js
declare const window: Window & {
  HUE_CONFIG?: HueConfig;
  WEATHER_CONFIG?: WeatherConfig & { LOCATION?: string };
  NEST_CONFIG?: NestConfig & {
    refresh_token?: string;
    access_token?: string;
    expires_at?: number;
    REFRESH_TOKEN?: string;
    ACCESS_TOKEN?: string;
    EXPIRES_AT?: number;
  };
};

/**
 * Bridge external config from window globals into the Registry
 * Call this after DOMContentLoaded when config.js has been executed
 */
export function bridgeExternalConfig(): void {
  if (typeof window === 'undefined') return;

  // Bridge HUE_CONFIG if present
  if (window.HUE_CONFIG) {
    Registry.register({
      key: 'HUE_CONFIG',
      instance: window.HUE_CONFIG,
    });
  }

  // Bridge WEATHER_CONFIG if present
  if (window.WEATHER_CONFIG) {
    Registry.register({
      key: 'WEATHER_CONFIG',
      instance: window.WEATHER_CONFIG,
    });
  }

  // Bridge NEST_CONFIG if present
  if (window.NEST_CONFIG) {
    Registry.register({
      key: 'NEST_CONFIG',
      instance: window.NEST_CONFIG,
    });
  }
}

/**
 * Get NEST_CONFIG with fallback to window global
 * Ensures config is available even if bridge timing is off
 */
export function getNestConfigWithFallback(): typeof window.NEST_CONFIG | undefined {
  // Try Registry first
  const fromRegistry = Registry.getOptional('NEST_CONFIG');
  if (fromRegistry) {
    return fromRegistry as typeof window.NEST_CONFIG;
  }

  // Fallback to window global (in case bridge hasn't run yet)
  if (typeof window !== 'undefined' && window.NEST_CONFIG) {
    // Also register it for future calls
    Registry.register({
      key: 'NEST_CONFIG',
      instance: window.NEST_CONFIG,
    });
    return window.NEST_CONFIG;
  }

  return undefined;
}

/**
 * Check if external configs are available
 * Useful for conditional initialization
 */
export function hasExternalConfig(
  config: 'hue' | 'weather' | 'nest'
): boolean {
  if (typeof window === 'undefined') return false;

  switch (config) {
    case 'hue':
      return !!window.HUE_CONFIG?.BRIDGE_IP;
    case 'weather':
      return !!window.WEATHER_CONFIG?.API_KEY;
    case 'nest':
      return !!(
        window.NEST_CONFIG?.CLIENT_ID &&
        window.NEST_CONFIG?.PROJECT_ID
      );
    default:
      return false;
  }
}

// Auto-bridge on module load (before other modules that depend on config)
bridgeExternalConfig();
