/**
 * Unit tests for shield.js
 * Tests NVIDIA SHIELD API functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShieldAPI } from './shield.js';

// ============================================
// Mock Setup
// ============================================

// Mock APP_CONFIG
globalThis.APP_CONFIG = {
    proxies: {
        shield: 'http://localhost:8082'
    },
    timeouts: {
        apiRequest: 10000,
        proxyCheck: 5000
    }
};

// Mock Logger - reset in beforeEach
const createLoggerMock = () => ({
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warn: vi.fn()
});
globalThis.Logger = createLoggerMock();

// Mock checkProxyAvailability
globalThis.checkProxyAvailability = vi.fn();

// ============================================
// ShieldAPI.checkAvailability Tests
// ============================================

describe('ShieldAPI.checkAvailability', () => {
    beforeEach(() => {
        globalThis.checkProxyAvailability = vi.fn();
    });

    it('should delegate to checkProxyAvailability', async () => {
        globalThis.checkProxyAvailability = vi.fn().mockResolvedValue(true);

        const result = await ShieldAPI.checkAvailability();

        expect(result).toBe(true);
        expect(checkProxyAvailability).toHaveBeenCalledWith(
            'http://localhost:8082/health',
            'SHIELD'
        );
    });

    it('should return false when proxy unavailable', async () => {
        globalThis.checkProxyAvailability = vi.fn().mockResolvedValue(false);

        const result = await ShieldAPI.checkAvailability();

        expect(result).toBe(false);
    });
});

// ============================================
// ShieldAPI.getApps Tests
// ============================================

describe('ShieldAPI.getApps', () => {
    beforeEach(() => {
        globalThis.Logger = createLoggerMock();
    });

    it('should return apps list on success', async () => {
        const mockApps = {
            apps: [
                { name: 'Netflix', packageName: 'com.netflix.ninja' },
                { name: 'YouTube', packageName: 'com.google.android.youtube' }
            ]
        };
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockApps)
        });

        const result = await ShieldAPI.getApps();

        expect(result).toEqual(mockApps);
        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:8082/apps',
            expect.objectContaining({ method: 'GET' })
        );
    });

    it('should return empty apps on HTTP error', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500
        });

        const result = await ShieldAPI.getApps();

        expect(result).toEqual({ apps: [] });
        expect(Logger.error).toHaveBeenCalled();
    });

    it('should return empty apps on network error', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const result = await ShieldAPI.getApps();

        expect(result).toEqual({ apps: [] });
        expect(Logger.error).toHaveBeenCalled();
    });
});

// ============================================
// ShieldAPI.getInfo Tests
// ============================================

describe('ShieldAPI.getInfo', () => {
    beforeEach(() => {
        globalThis.Logger = createLoggerMock();
    });

    it('should return device info on success', async () => {
        const mockInfo = {
            model: 'SHIELD Android TV',
            version: '9.0.0',
            ip: '192.168.68.80'
        };
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockInfo)
        });

        const result = await ShieldAPI.getInfo();

        expect(result).toEqual(mockInfo);
        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:8082/info',
            expect.objectContaining({ method: 'GET' })
        );
    });

    it('should return null on HTTP error', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500
        });

        const result = await ShieldAPI.getInfo();

        expect(result).toBeNull();
        expect(Logger.error).toHaveBeenCalled();
    });

    it('should return null on network error', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const result = await ShieldAPI.getInfo();

        expect(result).toBeNull();
        expect(Logger.error).toHaveBeenCalled();
    });
});

// ============================================
// ShieldAPI.launchApp Tests
// ============================================

describe('ShieldAPI.launchApp', () => {
    beforeEach(() => {
        globalThis.Logger = createLoggerMock();
    });

    it('should launch app and return result', async () => {
        const mockResult = { success: true, message: 'App launched' };
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockResult)
        });

        const result = await ShieldAPI.launchApp('Netflix');

        expect(result).toEqual(mockResult);
        expect(Logger.info).toHaveBeenCalledWith('Launching Netflix on SHIELD...');
        expect(Logger.success).toHaveBeenCalledWith('Netflix launched on SHIELD');
        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:8082/launch',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-App-Name': 'Netflix'
                }
            })
        );
    });

    it('should throw on HTTP error', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ error: 'Unknown app' })
        });

        await expect(ShieldAPI.launchApp('InvalidApp')).rejects.toThrow('Unknown app');
        expect(Logger.error).toHaveBeenCalled();
    });

    it('should throw on network error', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

        await expect(ShieldAPI.launchApp('Netflix')).rejects.toThrow('Connection refused');
        expect(Logger.error).toHaveBeenCalled();
    });
});

// ============================================
// ShieldAPI.stop Tests
// ============================================

describe('ShieldAPI.stop', () => {
    beforeEach(() => {
        globalThis.Logger = createLoggerMock();
    });

    it('should stop app and return result', async () => {
        const mockResult = { success: true, message: 'Returned to home' };
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockResult)
        });

        const result = await ShieldAPI.stop();

        expect(result).toEqual(mockResult);
        expect(Logger.info).toHaveBeenCalledWith('Stopping SHIELD app...');
        expect(Logger.success).toHaveBeenCalledWith('SHIELD returned to home screen');
        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:8082/stop',
            expect.objectContaining({ method: 'POST' })
        );
    });

    it('should throw on HTTP error', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: 'ADB error' })
        });

        await expect(ShieldAPI.stop()).rejects.toThrow('ADB error');
        expect(Logger.error).toHaveBeenCalled();
    });

    it('should throw on network error', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

        await expect(ShieldAPI.stop()).rejects.toThrow('Connection refused');
        expect(Logger.error).toHaveBeenCalled();
    });
});
