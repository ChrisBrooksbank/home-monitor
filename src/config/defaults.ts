/**
 * Configuration Defaults
 * Default values for home.config.json
 *
 * These are used as fallbacks when loading configuration.
 */

import type { HomeConfig } from './schema';

/**
 * Deep partial type for defaults (all properties optional)
 */
type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Default configuration values
 */
export const defaults: DeepPartial<HomeConfig> = {
    location: {
        name: 'Chelmsford, Essex, UK',
        coordinates: {
            lat: 51.7356,
            lng: 0.4685,
        },
        postcode: 'CM1 6UG',
    },

    proxies: {
        sonos: { host: 'localhost', port: 3000 },
        tapo: { host: 'localhost', port: 3001 },
        shield: { host: 'localhost', port: 8082 },
        nest: { host: 'localhost', port: 3003 },
        news: { host: 'localhost', port: 3002 },
    },

    intervals: {
        motionSensors: 3000,
        lights: 10000,
        sensorDetails: 10000,
        temperatures: 60000,
        motionLog: 60000,
        sky: 60000,
        sunTimes: 86400000, // 24 hours
        weather: 900000, // 15 minutes
        nest: 900000, // 15 minutes
        sonosVolume: 30000,
        tapoStatus: 30000,
        connectionStatus: 30000,
    },

    timeouts: {
        proxyCheck: 2000,
        apiRequest: 10000,
    },

    retry: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
    },

    history: {
        motionRetentionHours: 48,
        temperatureRetentionHours: 24,
    },

    services: {
        hue: null,
        weather: null,
        nest: null,
    },

    rooms: [
        'Main Bedroom',
        'Guest Bedroom',
        'Bathroom',
        'Landing',
        'Hall',
        'Home Office',
        'Lounge',
        'Kitchen',
        'Extension',
        'Outdoor',
    ],

    sensorToRoom: {
        landing: 'Landing',
        'main bedroom': 'Main Bedroom',
        'guest room': 'Guest Bedroom',
        'Hue temperature sensor 1': 'Home Office',
        bathroom: 'Bathroom',
        Hall: 'Hall',
        lounge: 'Lounge',
        ExtensionDimmer: 'Extension',
        KitchenSensor: 'Kitchen',
        'Hue outdoor temp. sensor 1': 'Outdoor',
    },

    lightPatterns: {
        'outdoor|outside|garden': 'Outdoor',
        guest: 'Guest Bedroom',
        'main bedroom|mainbedroom|^bedroomlight$|^bedroom$': 'Main Bedroom',
        landing: 'Landing',
        office: 'Home Office',
        'bathroom|bath': 'Bathroom',
        lounge: 'Lounge',
        hall: 'Hall',
        extension: 'Extension',
        kitchen: 'Kitchen',
    },

    motionPatterns: {
        'outdoor|outside|garden': 'Outdoor',
        'hall|frontdoor|front door': 'Hall',
        landing: 'Landing',
        'bathroom|bath': 'Bathroom',
    },

    devices: {
        hub: { ip: '192.168.68.62', port: 8008 },
    },

    debug: false,
};

/**
 * Deep merge two objects, with source values overwriting target values
 */
export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key of Object.keys(source) as (keyof T)[]) {
        const sourceVal = source[key];
        const targetVal = target[key];

        if (sourceVal === undefined) {
            continue;
        }

        if (
            sourceVal !== null &&
            typeof sourceVal === 'object' &&
            !Array.isArray(sourceVal) &&
            targetVal !== null &&
            typeof targetVal === 'object' &&
            !Array.isArray(targetVal)
        ) {
            result[key] = deepMerge(targetVal as object, sourceVal as object) as T[keyof T];
        } else {
            result[key] = sourceVal as T[keyof T];
        }
    }

    return result;
}
