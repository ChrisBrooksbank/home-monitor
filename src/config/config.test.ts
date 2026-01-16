/**
 * Unit tests for config loader and schema
 * Tests configuration loading, validation, and access
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    getConfig,
    isConfigLoaded,
    isServiceConfigured,
    getProxyUrl,
    resetConfig,
    setConfig,
} from './loader';
import { HomeConfigSchema, ConfigValidationError } from './schema';
import { defaults } from './defaults';
import type { HomeConfig } from './schema';

// ============================================
// Test Fixtures
// ============================================

const createValidConfig = (): HomeConfig => ({
    location: {
        name: 'Test Location',
        coordinates: { lat: 51.5, lng: -0.1 },
        postcode: 'SW1A 1AA',
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
        sunTimes: 86400000,
        weather: 900000,
        nest: 900000,
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
        hue: { bridgeIp: '192.168.1.100', username: 'test-user' },
        weather: { apiKey: 'test-api-key-12345' },
        nest: null,
    },
    debug: false,
});

// ============================================
// Setup / Teardown
// ============================================

beforeEach(() => {
    resetConfig();
});

afterEach(() => {
    resetConfig();
});

// ============================================
// Schema Validation Tests
// ============================================

describe('HomeConfigSchema validation', () => {
    it('should validate a complete valid config', () => {
        const config = createValidConfig();
        const result = HomeConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
    });

    it('should reject invalid latitude', () => {
        const config = createValidConfig();
        config.location.coordinates.lat = 100; // Invalid: must be -90 to 90
        const result = HomeConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
    });

    it('should reject invalid longitude', () => {
        const config = createValidConfig();
        config.location.coordinates.lng = 200; // Invalid: must be -180 to 180
        const result = HomeConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
    });

    it('should reject negative port numbers', () => {
        const config = createValidConfig();
        config.proxies.sonos.port = -1;
        const result = HomeConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
    });

    it('should reject port numbers above 65535', () => {
        const config = createValidConfig();
        config.proxies.sonos.port = 70000;
        const result = HomeConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
    });

    it('should reject non-positive intervals', () => {
        const config = createValidConfig();
        config.intervals.motionSensors = 0;
        const result = HomeConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
    });

    it('should allow null service configs', () => {
        const config = createValidConfig();
        config.services.hue = null;
        config.services.weather = null;
        config.services.nest = null;
        const result = HomeConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
    });

    it('should reject weather API key shorter than 10 chars', () => {
        const config = createValidConfig();
        config.services.weather = { apiKey: 'short' };
        const result = HomeConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
    });
});

// ============================================
// Config Loader Tests
// ============================================

describe('Config loader state management', () => {
    it('should start with config not loaded', () => {
        expect(isConfigLoaded()).toBe(false);
    });

    it('should throw when accessing config before loading', () => {
        expect(() => getConfig()).toThrow('Configuration not loaded');
    });

    it('should allow setting config directly', () => {
        const config = createValidConfig();
        setConfig(config);
        expect(isConfigLoaded()).toBe(true);
        expect(getConfig()).toBe(config);
    });

    it('should reset config state', () => {
        setConfig(createValidConfig());
        expect(isConfigLoaded()).toBe(true);
        resetConfig();
        expect(isConfigLoaded()).toBe(false);
    });
});

// ============================================
// Service Configuration Tests
// ============================================

describe('isServiceConfigured', () => {
    it('should return false when config not loaded', () => {
        expect(isServiceConfigured('hue')).toBe(false);
        expect(isServiceConfigured('weather')).toBe(false);
        expect(isServiceConfigured('nest')).toBe(false);
    });

    it('should detect configured hue service', () => {
        const config = createValidConfig();
        setConfig(config);
        expect(isServiceConfigured('hue')).toBe(true);
    });

    it('should detect unconfigured hue service', () => {
        const config = createValidConfig();
        config.services.hue = null;
        setConfig(config);
        expect(isServiceConfigured('hue')).toBe(false);
    });

    it('should detect configured weather service', () => {
        const config = createValidConfig();
        setConfig(config);
        expect(isServiceConfigured('weather')).toBe(true);
    });

    it('should detect unconfigured weather service', () => {
        const config = createValidConfig();
        config.services.weather = null;
        setConfig(config);
        expect(isServiceConfigured('weather')).toBe(false);
    });

    it('should require tokens for nest to be configured', () => {
        const config = createValidConfig();
        config.services.nest = {
            clientId: 'client-id',
            clientSecret: 'client-secret',
            projectId: 'project-id',
            tokens: null,
        };
        setConfig(config);
        expect(isServiceConfigured('nest')).toBe(false);
    });

    it('should detect fully configured nest service', () => {
        const config = createValidConfig();
        config.services.nest = {
            clientId: 'client-id',
            clientSecret: 'client-secret',
            projectId: 'project-id',
            tokens: {
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                expiresAt: Date.now() + 3600000,
            },
        };
        setConfig(config);
        expect(isServiceConfigured('nest')).toBe(true);
    });
});

// ============================================
// Proxy URL Tests
// ============================================

describe('getProxyUrl', () => {
    it('should construct correct proxy URLs', () => {
        setConfig(createValidConfig());
        expect(getProxyUrl('sonos')).toBe('http://localhost:3000');
        expect(getProxyUrl('tapo')).toBe('http://localhost:3001');
        expect(getProxyUrl('shield')).toBe('http://localhost:8082');
        expect(getProxyUrl('nest')).toBe('http://localhost:3003');
        expect(getProxyUrl('news')).toBe('http://localhost:3002');
    });

    it('should throw when config not loaded', () => {
        expect(() => getProxyUrl('sonos')).toThrow('Configuration not loaded');
    });
});

// ============================================
// Defaults Tests
// ============================================

describe('Default configuration values', () => {
    it('should have default location', () => {
        expect(defaults.location).toBeDefined();
        expect(defaults.location?.name).toBeDefined();
        expect(defaults.location?.coordinates).toBeDefined();
    });

    it('should have default proxy ports', () => {
        expect(defaults.proxies?.sonos?.port).toBe(3000);
        expect(defaults.proxies?.tapo?.port).toBe(3001);
        expect(defaults.proxies?.shield?.port).toBe(8082);
        expect(defaults.proxies?.nest?.port).toBe(3003);
        expect(defaults.proxies?.news?.port).toBe(3002);
    });

    it('should have default intervals', () => {
        expect(defaults.intervals?.motionSensors).toBeGreaterThan(0);
        expect(defaults.intervals?.lights).toBeGreaterThan(0);
        expect(defaults.intervals?.weather).toBeGreaterThan(0);
    });

    it('should have default timeouts', () => {
        expect(defaults.timeouts?.proxyCheck).toBeGreaterThan(0);
        expect(defaults.timeouts?.apiRequest).toBeGreaterThan(0);
    });

    it('should have default retry config', () => {
        expect(defaults.retry?.maxAttempts).toBeGreaterThan(0);
        expect(defaults.retry?.initialDelay).toBeGreaterThan(0);
        expect(defaults.retry?.maxDelay).toBeGreaterThan(0);
        expect(defaults.retry?.backoffMultiplier).toBeGreaterThan(1);
    });

    it('should have null service defaults', () => {
        expect(defaults.services?.hue).toBeNull();
        expect(defaults.services?.weather).toBeNull();
        expect(defaults.services?.nest).toBeNull();
    });

    it('should have debug disabled by default', () => {
        expect(defaults.debug).toBe(false);
    });
});

// ============================================
// ConfigValidationError Tests
// ============================================

describe('ConfigValidationError', () => {
    it('should format error messages correctly', () => {
        const errors = ['location.name: Required', 'proxies.sonos.port: Invalid'];
        const error = new ConfigValidationError(errors);
        expect(error.message).toContain('Configuration validation failed');
        expect(error.message).toContain('location.name: Required');
        expect(error.message).toContain('proxies.sonos.port: Invalid');
        expect(error.errors).toEqual(errors);
    });

    it('should have correct error name', () => {
        const error = new ConfigValidationError(['test error']);
        expect(error.name).toBe('ConfigValidationError');
    });
});
