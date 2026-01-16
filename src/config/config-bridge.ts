/**
 * Config Bridge
 * Bridges external config.js values into the Registry with validation
 *
 * config.js is loaded via script tag before the app and sets window globals.
 * This module validates and copies those values into the Registry.
 */

import { Registry } from '../core/registry';
import { Logger } from '../utils/logger';
import {
    HueConfigSchema,
    WeatherConfigSchema,
    NestConfigRawSchema,
    validateConfig,
} from './schemas';
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
 * Normalize Nest config to use consistent UPPER_CASE
 * Handles both ACCESS_TOKEN and access_token conventions
 */
function normalizeNestConfig(raw: typeof window.NEST_CONFIG): NestConfig | undefined {
    if (!raw) return undefined;

    return {
        CLIENT_ID: raw.CLIENT_ID,
        CLIENT_SECRET: raw.CLIENT_SECRET,
        PROJECT_ID: raw.PROJECT_ID,
        REDIRECT_URI: raw.REDIRECT_URI,
        ACCESS_TOKEN: raw.ACCESS_TOKEN ?? raw.access_token,
        REFRESH_TOKEN: raw.REFRESH_TOKEN ?? raw.refresh_token,
    };
}

/**
 * Bridge external config from window globals into the Registry
 * Validates configs and logs warnings for invalid values (but doesn't block)
 */
function bridgeExternalConfig(): void {
    if (typeof window === 'undefined') return;

    // Bridge HUE_CONFIG if present (with validation)
    if (window.HUE_CONFIG) {
        const result = validateConfig(HueConfigSchema, window.HUE_CONFIG, 'HUE_CONFIG');
        if (!result.success && result.errors) {
            Logger.warn('HUE_CONFIG validation issues:', result.errors);
        }
        Registry.register({
            key: 'HUE_CONFIG',
            instance: window.HUE_CONFIG,
        });
    }

    // Bridge WEATHER_CONFIG if present (with validation)
    if (window.WEATHER_CONFIG) {
        const result = validateConfig(WeatherConfigSchema, window.WEATHER_CONFIG, 'WEATHER_CONFIG');
        if (!result.success && result.errors) {
            Logger.warn('WEATHER_CONFIG validation issues:', result.errors);
        }
        Registry.register({
            key: 'WEATHER_CONFIG',
            instance: window.WEATHER_CONFIG,
        });
    }

    // Bridge NEST_CONFIG if present (with normalization and validation)
    if (window.NEST_CONFIG) {
        // Validate raw config first
        const rawResult = validateConfig(NestConfigRawSchema, window.NEST_CONFIG, 'NEST_CONFIG');
        if (!rawResult.success && rawResult.errors) {
            Logger.warn('NEST_CONFIG validation issues:', rawResult.errors);
        }

        // Normalize to consistent casing
        const normalized = normalizeNestConfig(window.NEST_CONFIG);
        if (normalized) {
            Registry.register({
                key: 'NEST_CONFIG',
                instance: normalized,
            });
        }
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
function hasExternalConfig(config: 'hue' | 'weather' | 'nest'): boolean {
    if (typeof window === 'undefined') return false;

    switch (config) {
        case 'hue':
            return !!window.HUE_CONFIG?.BRIDGE_IP;
        case 'weather':
            return !!window.WEATHER_CONFIG?.API_KEY;
        case 'nest':
            return !!(window.NEST_CONFIG?.CLIENT_ID && window.NEST_CONFIG?.PROJECT_ID);
        default:
            return false;
    }
}

// Auto-bridge on module load (before other modules that depend on config)
bridgeExternalConfig();
