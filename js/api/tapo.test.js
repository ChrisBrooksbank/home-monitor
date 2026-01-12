/**
 * Unit tests for tapo.js
 * Tests TP-Link Tapo Smart Plug API functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TapoAPI } from './tapo.js';

// ============================================
// Mock Setup
// ============================================

// Mock APP_CONFIG
globalThis.APP_CONFIG = {
    proxies: {
        tapo: 'http://localhost:3001'
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

// Mock retryWithBackoff - just executes the function directly
globalThis.retryWithBackoff = (fn) => fn();

// Mock checkProxyAvailability
globalThis.checkProxyAvailability = vi.fn();

// ============================================
// TapoAPI.request Tests
// ============================================

describe('TapoAPI.request', () => {
    beforeEach(() => {
        globalThis.Logger = createLoggerMock();
    });

    it('should make POST request to proxy', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ success: true })
        });

        const result = await TapoAPI.request('/test', { plugName: 'desk-lamp' });

        expect(result).toEqual({ success: true });
        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:3001/test',
            expect.objectContaining({
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plugName: 'desk-lamp' })
            })
        );
    });

    it('should throw on HTTP error', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500
        });

        await expect(TapoAPI.request('/test', {})).rejects.toThrow('HTTP 500');
    });

    it('should throw on network error', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        await expect(TapoAPI.request('/test', {})).rejects.toThrow('Network error');
        expect(Logger.error).toHaveBeenCalled();
    });

    it('should use abort signal with timeout', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({})
        });

        await TapoAPI.request('/test', {});

        expect(fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                signal: expect.anything()
            })
        );
    });
});

// ============================================
// TapoAPI.turnOn Tests
// ============================================

describe('TapoAPI.turnOn', () => {
    beforeEach(() => {
        globalThis.Logger = createLoggerMock();
    });

    it('should call /on endpoint with plug name', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ success: true })
        });

        const result = await TapoAPI.turnOn('desk-lamp');

        expect(result).toEqual({ success: true });
        expect(Logger.info).toHaveBeenCalledWith('Turning ON Tapo plug: desk-lamp');
        expect(Logger.success).toHaveBeenCalledWith('desk-lamp is now ON');
    });

    it('should use retryWithBackoff wrapper', async () => {
        // Track if our retry function was called
        let retryFunctionCalled = false;
        globalThis.retryWithBackoff = vi.fn((fn) => {
            retryFunctionCalled = true;
            return fn();
        });
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ success: true })
        });

        await TapoAPI.turnOn('test-plug');

        expect(retryFunctionCalled).toBe(true);
    });

    it('should throw on error', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection failed'));

        await expect(TapoAPI.turnOn('test-plug')).rejects.toThrow();
        expect(Logger.error).toHaveBeenCalled();
    });
});

// ============================================
// TapoAPI.turnOff Tests
// ============================================

describe('TapoAPI.turnOff', () => {
    beforeEach(() => {
        globalThis.Logger = createLoggerMock();
    });

    it('should call /off endpoint with plug name', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ success: true })
        });

        const result = await TapoAPI.turnOff('desk-lamp');

        expect(result).toEqual({ success: true });
        expect(Logger.info).toHaveBeenCalledWith('Turning OFF Tapo plug: desk-lamp');
        expect(Logger.success).toHaveBeenCalledWith('desk-lamp is now OFF');
    });

    it('should throw on error', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection failed'));

        await expect(TapoAPI.turnOff('test-plug')).rejects.toThrow();
        expect(Logger.error).toHaveBeenCalled();
    });
});

// ============================================
// TapoAPI.getStatus Tests
// ============================================

describe('TapoAPI.getStatus', () => {
    beforeEach(() => {
        globalThis.Logger = createLoggerMock();
    });

    it('should return status object on success', async () => {
        const mockStatus = { state: 'on', power: 15.5 };
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockStatus)
        });

        const result = await TapoAPI.getStatus('desk-lamp');

        expect(result).toEqual(mockStatus);
    });

    it('should return null on error', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const result = await TapoAPI.getStatus('desk-lamp');

        expect(result).toBeNull();
        expect(Logger.error).toHaveBeenCalled();
    });
});

// ============================================
// TapoAPI.toggle Tests
// ============================================

describe('TapoAPI.toggle', () => {
    beforeEach(() => {
        globalThis.Logger = createLoggerMock();
    });

    it('should turn off when currently on', async () => {
        // First call returns status (on), second call is turnOff
        let callCount = 0;
        globalThis.fetch = vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // getStatus call
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ state: 'on' })
                });
            } else {
                // turnOff call
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: true })
                });
            }
        });

        await TapoAPI.toggle('desk-lamp');

        expect(Logger.info).toHaveBeenCalledWith('Toggling Tapo plug: desk-lamp');
        // Should have called turnOff (the second fetch)
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should turn on when currently off', async () => {
        let callCount = 0;
        globalThis.fetch = vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ state: 'off' })
                });
            } else {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ success: true })
                });
            }
        });

        await TapoAPI.toggle('desk-lamp');

        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should throw on status error', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        await expect(TapoAPI.toggle('desk-lamp')).rejects.toThrow();
    });
});

// ============================================
// TapoAPI.getPlugs Tests
// ============================================

describe('TapoAPI.getPlugs', () => {
    beforeEach(() => {
        globalThis.Logger = createLoggerMock();
    });

    it('should return plugs list on success', async () => {
        const mockPlugs = {
            plugs: {
                'desk-lamp': { ip: '192.168.68.100' },
                'fan': { ip: '192.168.68.101' }
            },
            count: 2
        };
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockPlugs)
        });

        const result = await TapoAPI.getPlugs();

        expect(result).toEqual(mockPlugs);
        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:3001/plugs',
            expect.objectContaining({ method: 'GET' })
        );
    });

    it('should return empty object on error', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const result = await TapoAPI.getPlugs();

        expect(result).toEqual({ plugs: {}, count: 0 });
        expect(Logger.error).toHaveBeenCalled();
    });
});

// ============================================
// TapoAPI.discover Tests
// ============================================

describe('TapoAPI.discover', () => {
    beforeEach(() => {
        globalThis.Logger = createLoggerMock();
    });

    it('should trigger discovery and return results', async () => {
        const mockResult = {
            success: true,
            count: 3,
            plugs: { 'plug-1': {}, 'plug-2': {}, 'plug-3': {} }
        };
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockResult)
        });

        const result = await TapoAPI.discover();

        expect(result).toEqual(mockResult);
        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:3001/discover',
            expect.objectContaining({
                method: 'POST',
                signal: expect.anything()
            })
        );
        expect(Logger.info).toHaveBeenCalledWith('Starting Tapo plug discovery...');
        expect(Logger.success).toHaveBeenCalledWith('Discovered 3 Tapo plugs');
    });

    it('should use 60 second timeout', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ success: true, count: 0 })
        });

        await TapoAPI.discover();

        // Check that AbortSignal.timeout was called with 60000
        expect(fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                signal: expect.anything()
            })
        );
    });

    it('should throw on error', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Discovery failed'));

        await expect(TapoAPI.discover()).rejects.toThrow('Discovery failed');
        expect(Logger.error).toHaveBeenCalled();
    });
});

// ============================================
// TapoAPI.checkAvailability Tests
// ============================================

describe('TapoAPI.checkAvailability', () => {
    beforeEach(() => {
        globalThis.checkProxyAvailability = vi.fn();
    });

    it('should delegate to checkProxyAvailability', async () => {
        globalThis.checkProxyAvailability = vi.fn().mockResolvedValue(true);

        const result = await TapoAPI.checkAvailability();

        expect(result).toBe(true);
        expect(checkProxyAvailability).toHaveBeenCalledWith(
            'http://localhost:3001/plugs',
            'Tapo'
        );
    });

    it('should return false when proxy unavailable', async () => {
        globalThis.checkProxyAvailability = vi.fn().mockResolvedValue(false);

        const result = await TapoAPI.checkAvailability();

        expect(result).toBe(false);
    });
});
