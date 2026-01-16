/**
 * Config Facade
 * Unified access point for all configuration
 *
 * Use this instead of direct Registry access for configuration:
 *   - Config.app - APP_CONFIG (always available)
 *   - Config.hue - HUE_CONFIG (may be undefined)
 *   - Config.weather - WEATHER_CONFIG (may be undefined)
 *   - Config.nest - NEST_CONFIG (may be undefined)
 */

import { Registry } from '../core/registry';
import { APP_CONFIG } from './constants';
import { Logger } from '../utils/logger';
import type { HueConfig, WeatherConfig, NestConfig, AppConfig } from '../types';

// =============================================================================
// CONFIG STATUS INTERFACE
// =============================================================================

export interface ConfigStatus {
    available: boolean;
    message: string;
}

// =============================================================================
// CONFIG FACADE
// =============================================================================

/**
 * Unified configuration access
 */
export const Config = {
    /**
     * Get APP_CONFIG (always available)
     */
    get app(): AppConfig {
        return APP_CONFIG;
    },

    /**
     * Get HUE_CONFIG (may be undefined if not configured)
     */
    get hue(): HueConfig | undefined {
        return Registry.getOptional('HUE_CONFIG');
    },

    /**
     * Get WEATHER_CONFIG (may be undefined if not configured)
     */
    get weather(): (WeatherConfig & { LOCATION?: string }) | undefined {
        return Registry.getOptional('WEATHER_CONFIG');
    },

    /**
     * Get NEST_CONFIG (may be undefined if not configured)
     */
    get nest(): NestConfig | undefined {
        return Registry.getOptional('NEST_CONFIG');
    },

    /**
     * Check if Hue is properly configured
     */
    get isHueConfigured(): boolean {
        const config = this.hue;
        return !!config?.BRIDGE_IP && !!config?.USERNAME;
    },

    /**
     * Check if Weather API is properly configured
     */
    get isWeatherConfigured(): boolean {
        const config = this.weather;
        return (
            !!config?.API_KEY &&
            config.API_KEY !== 'YOUR-WEATHERAPI-KEY-HERE' &&
            config.API_KEY.length > 10
        );
    },

    /**
     * Check if Nest is properly configured with valid tokens
     */
    get isNestConfigured(): boolean {
        const config = this.nest;
        return !!(config?.CLIENT_ID && config?.PROJECT_ID && config?.ACCESS_TOKEN);
    },

    /**
     * Get proxy URL for a service
     */
    proxy(service: keyof AppConfig['proxies']): string {
        return APP_CONFIG.proxies[service];
    },

    /**
     * Get polling interval for a service
     */
    interval(name: keyof AppConfig['intervals']): number {
        return APP_CONFIG.intervals[name];
    },

    /**
     * Get timeout value
     */
    timeout(name: keyof AppConfig['timeouts']): number {
        return APP_CONFIG.timeouts[name];
    },
} as const;

// =============================================================================
// CONFIG STATUS UTILITIES
// =============================================================================

/**
 * Check configuration status for graceful degradation
 */
export const ConfigStatus = {
    /**
     * Check Hue configuration status
     */
    hue(): ConfigStatus {
        if (!Config.isHueConfigured) {
            return {
                available: false,
                message: 'Hue Bridge not configured. Add config.js with BRIDGE_IP and USERNAME.',
            };
        }
        return { available: true, message: 'Hue configured' };
    },

    /**
     * Check Weather configuration status
     */
    weather(): ConfigStatus {
        if (!Config.isWeatherConfigured) {
            return {
                available: false,
                message: 'Weather API not configured. Add API_KEY to config.js.',
            };
        }
        return { available: true, message: 'Weather configured' };
    },

    /**
     * Check Nest configuration status
     */
    nest(): ConfigStatus {
        const config = Config.nest;
        if (!config) {
            return {
                available: false,
                message: 'Nest not configured. Run: npx tsx src/scripts/setup/nest-auth.ts',
            };
        }
        if (!config.ACCESS_TOKEN) {
            return {
                available: false,
                message: 'Nest access token missing. Re-run auth setup.',
            };
        }
        return { available: true, message: 'Nest configured' };
    },

    /**
     * Check all configurations
     */
    all(): Record<'hue' | 'weather' | 'nest', ConfigStatus> {
        return {
            hue: ConfigStatus.hue(),
            weather: ConfigStatus.weather(),
            nest: ConfigStatus.nest(),
        };
    },
};

// =============================================================================
// GRACEFUL DEGRADATION HELPER
// =============================================================================

/**
 * Execute a function only if config is available (graceful degradation)
 *
 * @example
 * withConfiguredFeature('Weather', Config.isWeatherConfigured, () => {
 *     initWeather();
 * });
 */
export function withConfiguredFeature<T>(
    featureName: string,
    isConfigured: boolean,
    fn: () => T
): T | undefined {
    if (!isConfigured) {
        Logger.info(`${featureName} skipped: not configured`);
        return undefined;
    }
    return fn();
}

// Register Config with Registry for consistency
Registry.register({ key: 'CONFIG', instance: Config });
