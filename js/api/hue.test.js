/**
 * Unit tests for hue.js
 * Tests Philips Hue Bridge API functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HueAPI, getBridgeConfig } from './hue.js';

// ============================================
// Mock Setup
// ============================================

// Mock HUE_CONFIG
globalThis.window = globalThis.window || {};
globalThis.window.HUE_CONFIG = {
    BRIDGE_IP: '192.168.68.51',
    USERNAME: 'test-user-12345'
};

// ============================================
// getBridgeConfig Tests
// ============================================

describe('getBridgeConfig', () => {
    it('should return config from window.HUE_CONFIG', () => {
        const config = getBridgeConfig();

        expect(config.ip).toBe('192.168.68.51');
        expect(config.username).toBe('test-user-12345');
    });

    it('should return defaults when HUE_CONFIG is missing', () => {
        const originalConfig = window.HUE_CONFIG;
        window.HUE_CONFIG = undefined;

        const config = getBridgeConfig();

        expect(config.ip).toBe('192.168.68.51'); // default
        expect(config.username).toBe('');

        window.HUE_CONFIG = originalConfig;
    });
});

// ============================================
// HueAPI.getBaseUrl Tests
// ============================================

describe('HueAPI.getBaseUrl', () => {
    it('should construct correct base URL', () => {
        const url = HueAPI.getBaseUrl();

        expect(url).toBe('http://192.168.68.51/api/test-user-12345');
    });
});

// ============================================
// HueAPI.getAllLights Tests
// ============================================

describe('HueAPI.getAllLights', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should return lights on success', async () => {
        const mockLights = {
            '1': { name: 'Kitchen', state: { on: true } },
            '2': { name: 'Bedroom', state: { on: false } }
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockLights)
        });

        const result = await HueAPI.getAllLights();

        expect(result).toEqual(mockLights);
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/lights'));
    });

    it('should return null on error', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const result = await HueAPI.getAllLights();

        expect(result).toBeNull();
    });

    it('should return null on non-ok response', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false
        });

        const result = await HueAPI.getAllLights();

        expect(result).toBeNull();
    });
});

// ============================================
// HueAPI.getLight Tests
// ============================================

describe('HueAPI.getLight', () => {
    it('should return single light on success', async () => {
        const mockLight = { name: 'Kitchen', state: { on: true, bri: 254 } };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockLight)
        });

        const result = await HueAPI.getLight('1');

        expect(result).toEqual(mockLight);
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/lights/1'));
    });

    it('should return null on error', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const result = await HueAPI.getLight('1');

        expect(result).toBeNull();
    });
});

// ============================================
// HueAPI.setLightState Tests
// ============================================

describe('HueAPI.setLightState', () => {
    it('should send PUT request with state', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

        const result = await HueAPI.setLightState('1', { on: true, bri: 200 });

        expect(result).toBe(true);
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/lights/1/state'),
            expect.objectContaining({
                method: 'PUT',
                body: JSON.stringify({ on: true, bri: 200 })
            })
        );
    });

    it('should return false on error', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const result = await HueAPI.setLightState('1', { on: true });

        expect(result).toBe(false);
    });

    it('should return false on non-ok response', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

        const result = await HueAPI.setLightState('1', { on: true });

        expect(result).toBe(false);
    });
});

// ============================================
// HueAPI.toggleLight Tests
// ============================================

describe('HueAPI.toggleLight', () => {
    it('should toggle light off when currently on', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

        await HueAPI.toggleLight('1', true);

        expect(fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                body: JSON.stringify({ on: false })
            })
        );
    });

    it('should toggle light on when currently off', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

        await HueAPI.toggleLight('1', false);

        expect(fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                body: JSON.stringify({ on: true })
            })
        );
    });
});

// ============================================
// HueAPI.getAllSensors Tests
// ============================================

describe('HueAPI.getAllSensors', () => {
    it('should return sensors on success', async () => {
        const mockSensors = {
            '1': { type: 'ZLLTemperature', state: { temperature: 2150 } }
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockSensors)
        });

        const result = await HueAPI.getAllSensors();

        expect(result).toEqual(mockSensors);
    });

    it('should return null on error', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const result = await HueAPI.getAllSensors();

        expect(result).toBeNull();
    });
});

// ============================================
// HueAPI.getTemperatureSensors Tests
// ============================================

describe('HueAPI.getTemperatureSensors', () => {
    it('should filter and transform temperature sensors', async () => {
        const mockSensors = {
            '1': { type: 'ZLLTemperature', name: 'Bedroom Temp', state: { temperature: 2150, lastupdated: '2024-01-01T12:00:00' } },
            '2': { type: 'ZLLPresence', name: 'Motion', state: { presence: true } },
            '3': { type: 'ZLLTemperature', name: 'Kitchen Temp', state: { temperature: 1980, lastupdated: '2024-01-01T12:00:00' } }
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockSensors)
        });

        const result = await HueAPI.getTemperatureSensors();

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            id: '1',
            name: 'Bedroom Temp',
            temperature: 21.5, // Divided by 100
            lastUpdated: '2024-01-01T12:00:00'
        });
        expect(result[1].temperature).toBe(19.8);
    });

    it('should return empty array on null sensors', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });

        const result = await HueAPI.getTemperatureSensors();

        expect(result).toEqual([]);
    });

    it('should skip sensors with null temperature', async () => {
        const mockSensors = {
            '1': { type: 'ZLLTemperature', name: 'Broken', state: { temperature: null } }
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockSensors)
        });

        const result = await HueAPI.getTemperatureSensors();

        expect(result).toEqual([]);
    });
});

// ============================================
// HueAPI.getMotionSensors Tests
// ============================================

describe('HueAPI.getMotionSensors', () => {
    it('should filter and transform motion sensors', async () => {
        const mockSensors = {
            '1': { type: 'ZLLPresence', name: 'Bedroom Motion', state: { presence: true, lastupdated: '2024-01-01T12:00:00' }, config: { battery: 80 } },
            '2': { type: 'ZLLTemperature', name: 'Temp', state: { temperature: 2000 } },
            '3': { type: 'ZLLPresence', name: 'Kitchen Motion', state: { presence: false, lastupdated: '2024-01-01T12:00:00' }, config: { battery: 60 } }
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockSensors)
        });

        const result = await HueAPI.getMotionSensors();

        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({
            id: '1',
            name: 'Bedroom Motion',
            presence: true,
            lastUpdated: '2024-01-01T12:00:00',
            battery: 80
        });
    });

    it('should return empty array on error', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const result = await HueAPI.getMotionSensors();

        expect(result).toEqual([]);
    });
});

// ============================================
// HueAPI.getLightLevelSensors Tests
// ============================================

describe('HueAPI.getLightLevelSensors', () => {
    it('should filter and transform light level sensors', async () => {
        const mockSensors = {
            '1': { type: 'ZLLLightLevel', name: 'Bedroom Light', state: { lightlevel: 15000, dark: false, daylight: true, lastupdated: '2024-01-01T12:00:00' } },
            '2': { type: 'ZLLPresence', name: 'Motion', state: { presence: true } }
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockSensors)
        });

        const result = await HueAPI.getLightLevelSensors();

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            id: '1',
            name: 'Bedroom Light',
            lightLevel: 15000,
            dark: false,
            daylight: true,
            lastUpdated: '2024-01-01T12:00:00'
        });
    });

    it('should skip sensors with null lightlevel', async () => {
        const mockSensors = {
            '1': { type: 'ZLLLightLevel', name: 'Broken', state: { lightlevel: null } }
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockSensors)
        });

        const result = await HueAPI.getLightLevelSensors();

        expect(result).toEqual([]);
    });
});

// ============================================
// HueAPI.getBridgeInfo Tests
// ============================================

describe('HueAPI.getBridgeInfo', () => {
    it('should return bridge config on success', async () => {
        const mockConfig = {
            name: 'Hue Bridge',
            modelid: 'BSB002',
            bridgeid: '001788FFFE123456'
        };

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockConfig)
        });

        const result = await HueAPI.getBridgeInfo();

        expect(result).toEqual(mockConfig);
        expect(fetch).toHaveBeenCalledWith('http://192.168.68.51/api/config');
    });

    it('should return null on error', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const result = await HueAPI.getBridgeInfo();

        expect(result).toBeNull();
    });
});
