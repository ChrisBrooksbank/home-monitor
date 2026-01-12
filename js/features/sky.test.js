/**
 * Unit tests for sky.js
 * Tests sky feature module - time of day, sky configuration, sun position
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the constants module before importing sky.js
vi.mock('../config/constants.js', () => ({
    LOCATION: {
        LAT: 51.5074,
        LNG: -0.1278
    }
}));

// Now import sky functions
import {
    getTimeOfDay,
    getSkyConfig,
    getSunPosition,
    isDaytime,
    isNighttime,
    fetchSunTimes
} from './sky.js';

// ============================================
// Mock Setup
// ============================================

// Mock Logger
globalThis.Logger = {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warn: vi.fn()
};

// Mock document
globalThis.document = {
    getElementById: vi.fn()
};

// Mock window.matchMedia
globalThis.window = globalThis.window || {};
globalThis.window.matchMedia = vi.fn(() => ({ matches: false }));

// ============================================
// getSkyConfig Tests
// ============================================

describe('getSkyConfig', () => {
    it('should return dawn config', () => {
        const config = getSkyConfig('dawn');

        expect(config.color1).toBe('#FF6B6B');
        expect(config.color2).toBe('#FFD93D');
        expect(config.showSun).toBe(true);
        expect(config.showMoon).toBe(false);
        expect(config.showStars).toBe(false);
    });

    it('should return day config', () => {
        const config = getSkyConfig('day');

        expect(config.color1).toBe('#87CEEB');
        expect(config.color2).toBe('#E0F6FF');
        expect(config.showSun).toBe(true);
        expect(config.showMoon).toBe(false);
        expect(config.showStars).toBe(false);
    });

    it('should return dusk config', () => {
        const config = getSkyConfig('dusk');

        expect(config.color1).toBe('#FF6B35');
        expect(config.color2).toBe('#6A4C93');
        expect(config.showSun).toBe(true);
        expect(config.showMoon).toBe(false);
        expect(config.showStars).toBe(true);
    });

    it('should return night config', () => {
        const config = getSkyConfig('night');

        expect(config.color1).toBe('#0B1026');
        expect(config.color2).toBe('#1E3A5F');
        expect(config.showSun).toBe(false);
        expect(config.showMoon).toBe(true);
        expect(config.showStars).toBe(true);
    });

    it('should return night config for unknown period', () => {
        const config = getSkyConfig('unknown');

        expect(config).toEqual(getSkyConfig('night'));
    });
});

// ============================================
// getTimeOfDay Tests
// ============================================

describe('getTimeOfDay', () => {
    let realDate;

    beforeEach(() => {
        realDate = global.Date;
    });

    afterEach(() => {
        global.Date = realDate;
    });

    it('should return one of the valid periods', () => {
        const period = getTimeOfDay();

        expect(['night', 'dawn', 'day', 'dusk']).toContain(period);
    });
});

// ============================================
// getSunPosition Tests
// ============================================

describe('getSunPosition', () => {
    it('should return position object with x and y', () => {
        const position = getSunPosition();

        expect(position).toHaveProperty('x');
        expect(position).toHaveProperty('y');
        expect(typeof position.x).toBe('number');
        expect(typeof position.y).toBe('number');
    });

    it('should return default position when sun times not set', () => {
        // The module uses internal sunriseTime/sunsetTime that may be null initially
        // If null, it returns default position
        const position = getSunPosition();

        expect(position.x).toBeGreaterThanOrEqual(100);
        expect(position.x).toBeLessThanOrEqual(900);
        expect(position.y).toBeGreaterThanOrEqual(50);
        expect(position.y).toBeLessThanOrEqual(150);
    });
});

// ============================================
// isDaytime Tests
// ============================================

describe('isDaytime', () => {
    it('should return boolean', () => {
        const result = isDaytime();

        expect(typeof result).toBe('boolean');
    });
});

// ============================================
// isNighttime Tests
// ============================================

describe('isNighttime', () => {
    it('should return boolean', () => {
        const result = isNighttime();

        expect(typeof result).toBe('boolean');
    });

    it('should be opposite of isDaytime when period is not dusk/dawn', () => {
        // At night: isNighttime = true, isDaytime = false
        // At day: isNighttime = false, isDaytime = true
        // At dawn/dusk: isNighttime = false, isDaytime = true
        // So isNighttime implies !isDaytime, but !isNighttime doesn't imply isDaytime
        if (isNighttime()) {
            expect(isDaytime()).toBe(false);
        }
    });
});

// ============================================
// fetchSunTimes Tests
// ============================================

describe('fetchSunTimes', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        globalThis.Logger = {
            info: vi.fn(),
            error: vi.fn(),
            success: vi.fn(),
            warn: vi.fn()
        };
        globalThis.document = {
            getElementById: vi.fn().mockReturnValue(null)
        };
    });

    it('should fetch sun times from API on success', async () => {
        const mockSunrise = '2024-01-15T07:00:00+00:00';
        const mockSunset = '2024-01-15T17:00:00+00:00';

        globalThis.fetch = vi.fn().mockResolvedValue({
            json: () => Promise.resolve({
                status: 'OK',
                results: {
                    sunrise: mockSunrise,
                    sunset: mockSunset
                }
            })
        });

        const result = await fetchSunTimes();

        expect(result).not.toBeNull();
        expect(result.sunrise).toBeInstanceOf(Date);
        expect(result.sunset).toBeInstanceOf(Date);
        expect(Logger.info).toHaveBeenCalled();
    });

    it('should return null on API error', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const result = await fetchSunTimes();

        expect(result).toBeNull();
        expect(Logger.error).toHaveBeenCalled();
    });

    it('should return null when API returns non-OK status', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            json: () => Promise.resolve({
                status: 'INVALID_REQUEST'
            })
        });

        const result = await fetchSunTimes();

        expect(result).toBeNull();
    });
});

// ============================================
// Sky Config Completeness Tests
// ============================================

describe('Sky config completeness', () => {
    const periods = ['dawn', 'day', 'dusk', 'night'];

    periods.forEach(period => {
        it(`${period} config should have all required properties`, () => {
            const config = getSkyConfig(period);

            expect(config).toHaveProperty('color1');
            expect(config).toHaveProperty('color2');
            expect(config).toHaveProperty('showSun');
            expect(config).toHaveProperty('showMoon');
            expect(config).toHaveProperty('showStars');
        });

        it(`${period} colors should be valid hex colors`, () => {
            const config = getSkyConfig(period);
            const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

            expect(config.color1).toMatch(hexColorRegex);
            expect(config.color2).toMatch(hexColorRegex);
        });

        it(`${period} visibility flags should be booleans`, () => {
            const config = getSkyConfig(period);

            expect(typeof config.showSun).toBe('boolean');
            expect(typeof config.showMoon).toBe('boolean');
            expect(typeof config.showStars).toBe('boolean');
        });
    });
});
