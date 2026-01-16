/**
 * Registry Helper Functions
 * Shared utilities for accessing registered services and configuration
 */

import { Registry } from '../core/registry';
import { getConfig, isConfigLoaded } from '../config';
import type { AppState as AppStateType } from '../core/state';
import type { AppEvents as AppEventsType } from '../core/events';

// =============================================================================
// BACKWARD-COMPATIBLE CONFIG ACCESSORS
// =============================================================================

// Type for the legacy AppConfig format that other modules expect
interface LegacyAppConfig {
    proxies: {
        sonos: string;
        tapo: string;
        shield: string;
        nest: string;
    };
    intervals: {
        motionSensors: number;
        lights: number;
        sensorDetails: number;
        temperatures: number;
        motionLog: number;
        sky: number;
        sunTimes: number;
        weather: number;
        nest: number;
        sonosVolume: number;
        tapoStatus: number;
        connectionStatus: number;
    };
    timeouts: {
        proxyCheck: number;
        apiRequest: number;
    };
    retry: {
        maxAttempts: number;
        initialDelay: number;
        maxDelay: number;
        backoffMultiplier: number;
    };
    debug: boolean;
    defaults: {
        hue: {
            BRIDGE_IP: string;
        };
        weather: {
            LOCATION: string;
            UPDATE_INTERVAL: number;
        };
    };
}

/**
 * Get APP_CONFIG in legacy format for backward compatibility
 * This converts the new HomeConfig to the old AppConfig format
 */
export function getAppConfig(): LegacyAppConfig | undefined {
    if (!isConfigLoaded()) {
        return undefined;
    }

    const config = getConfig();

    // Convert new format to legacy format
    return {
        proxies: {
            sonos: `http://${config.proxies.sonos.host}:${config.proxies.sonos.port}`,
            tapo: `http://${config.proxies.tapo.host}:${config.proxies.tapo.port}`,
            shield: `http://${config.proxies.shield.host}:${config.proxies.shield.port}`,
            nest: `http://${config.proxies.nest.host}:${config.proxies.nest.port}`,
        },
        intervals: config.intervals,
        timeouts: config.timeouts,
        retry: config.retry,
        debug: config.debug,
        defaults: {
            hue: {
                BRIDGE_IP: config.services.hue?.bridgeIp ?? '192.168.68.51',
            },
            weather: {
                LOCATION: config.location.postcode ?? config.location.name,
                UPDATE_INTERVAL: 15,
            },
        },
    };
}

// =============================================================================
// REGISTRY ACCESSORS (unchanged)
// =============================================================================

/**
 * Get AppState from Registry
 */
export function getAppState(): typeof AppStateType | undefined {
    return Registry.getOptional('AppState');
}

/**
 * Get AppEvents from Registry
 */
export function getAppEvents(): typeof AppEventsType | undefined {
    return Registry.getOptional('AppEvents');
}
