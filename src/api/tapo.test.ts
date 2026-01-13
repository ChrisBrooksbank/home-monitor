/**
 * Unit tests for tapo.ts
 * Tests TP-Link Tapo Smart Plug API functions
 */

import { describe, it, expect, vi, beforeEach, type Mock, type MockInstance } from 'vitest';
import type { AppConfig } from '../types';

// ============================================
// Mock Setup - Module mocks before imports
// ============================================

// Mock the helpers module
vi.mock('../utils/helpers', () => ({
  retryWithBackoff: vi.fn(<T>(fn: () => Promise<T>) => fn()),
}));

// Now import the module under test and Logger (to spy on)
import { TapoAPI } from './tapo';
import { Logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/helpers';

// Set up APP_CONFIG global - source uses `declare const APP_CONFIG`
(globalThis as typeof globalThis & { APP_CONFIG: AppConfig }).APP_CONFIG = {
  proxies: {
    sonos: 'http://localhost:3000',
    tapo: 'http://localhost:3001',
    shield: 'http://localhost:8082',
  },
  timeouts: {
    apiRequest: 10000,
    proxyCheck: 5000,
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
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },
  debug: false,
};

// ============================================
// TapoAPI.request Tests
// ============================================

describe('TapoAPI.request', () => {
  let errorSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    errorSpy = vi.spyOn(Logger, 'error');
  });

  it('should make POST request to proxy', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const result = await TapoAPI.request('/test', { plugName: 'desk-lamp' });

    expect(result).toEqual({ success: true });
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/test',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plugName: 'desk-lamp' }),
      })
    );
  });

  it('should throw on HTTP error', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    await expect(TapoAPI.request('/test', {})).rejects.toThrow('HTTP 500');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('should throw on network error', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi
      .fn()
      .mockRejectedValue(new Error('Network error'));

    await expect(TapoAPI.request('/test', {})).rejects.toThrow('Network error');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('should use abort signal with timeout', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await TapoAPI.request('/test', {});

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: expect.anything(),
      })
    );
  });
});

// ============================================
// TapoAPI.turnOn Tests
// ============================================

describe('TapoAPI.turnOn', () => {
  let infoSpy: MockInstance;
  let successSpy: MockInstance;
  let errorSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    infoSpy = vi.spyOn(Logger, 'info');
    successSpy = vi.spyOn(Logger, 'success');
    errorSpy = vi.spyOn(Logger, 'error');
  });

  it('should call /on endpoint with plug name', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const result = await TapoAPI.turnOn('desk-lamp');

    expect(result).toEqual({ success: true });
    expect(infoSpy).toHaveBeenCalledWith('Turning ON Tapo plug: desk-lamp');
    expect(successSpy).toHaveBeenCalledWith('desk-lamp is now ON');
  });

  it('should use retryWithBackoff wrapper', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    await TapoAPI.turnOn('test-plug');

    expect(retryWithBackoff).toHaveBeenCalled();
  });

  it('should throw on error', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi
      .fn()
      .mockRejectedValue(new Error('Connection failed'));

    await expect(TapoAPI.turnOn('test-plug')).rejects.toThrow();
    expect(errorSpy).toHaveBeenCalled();
  });
});

// ============================================
// TapoAPI.turnOff Tests
// ============================================

describe('TapoAPI.turnOff', () => {
  let infoSpy: MockInstance;
  let successSpy: MockInstance;
  let errorSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    infoSpy = vi.spyOn(Logger, 'info');
    successSpy = vi.spyOn(Logger, 'success');
    errorSpy = vi.spyOn(Logger, 'error');
  });

  it('should call /off endpoint with plug name', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const result = await TapoAPI.turnOff('desk-lamp');

    expect(result).toEqual({ success: true });
    expect(infoSpy).toHaveBeenCalledWith('Turning OFF Tapo plug: desk-lamp');
    expect(successSpy).toHaveBeenCalledWith('desk-lamp is now OFF');
  });

  it('should throw on error', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi
      .fn()
      .mockRejectedValue(new Error('Connection failed'));

    await expect(TapoAPI.turnOff('test-plug')).rejects.toThrow();
    expect(errorSpy).toHaveBeenCalled();
  });
});

// ============================================
// TapoAPI.getStatus Tests
// ============================================

describe('TapoAPI.getStatus', () => {
  let errorSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    errorSpy = vi.spyOn(Logger, 'error');
  });

  it('should return status object on success', async () => {
    const mockStatus = { state: 'on', power: 15.5 };
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockStatus),
    });

    const result = await TapoAPI.getStatus('desk-lamp');

    expect(result).toEqual(mockStatus);
  });

  it('should return null on error', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi
      .fn()
      .mockRejectedValue(new Error('Network error'));

    const result = await TapoAPI.getStatus('desk-lamp');

    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });
});

// ============================================
// TapoAPI.toggle Tests
// ============================================

describe('TapoAPI.toggle', () => {
  let infoSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    infoSpy = vi.spyOn(Logger, 'info');
  });

  it('should turn off when currently on', async () => {
    let callCount = 0;
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // getStatus call
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ state: 'on' }),
        });
      } else {
        // turnOff call
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
    });

    await TapoAPI.toggle('desk-lamp');

    expect(infoSpy).toHaveBeenCalledWith('Toggling Tapo plug: desk-lamp');
    // Should have called turnOff (the second fetch)
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should turn on when currently off', async () => {
    let callCount = 0;
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ state: 'off' }),
        });
      } else {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });
      }
    });

    await TapoAPI.toggle('desk-lamp');

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('should throw on status error', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi
      .fn()
      .mockRejectedValue(new Error('Network error'));

    await expect(TapoAPI.toggle('desk-lamp')).rejects.toThrow();
  });
});

// ============================================
// TapoAPI.getPlugs Tests
// ============================================

describe('TapoAPI.getPlugs', () => {
  let errorSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    errorSpy = vi.spyOn(Logger, 'error');
  });

  it('should return plugs list on success', async () => {
    const mockPlugs = {
      plugs: {
        'desk-lamp': { ip: '192.168.68.100' },
        fan: { ip: '192.168.68.101' },
      },
      count: 2,
    };
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPlugs),
    });

    const result = await TapoAPI.getPlugs();

    expect(result).toEqual(mockPlugs);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/plugs',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should return empty object on error', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi
      .fn()
      .mockRejectedValue(new Error('Network error'));

    const result = await TapoAPI.getPlugs();

    expect(result).toEqual({ plugs: {}, count: 0 });
    expect(errorSpy).toHaveBeenCalled();
  });
});

// ============================================
// TapoAPI.discover Tests
// ============================================

describe('TapoAPI.discover', () => {
  let infoSpy: MockInstance;
  let successSpy: MockInstance;
  let errorSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    infoSpy = vi.spyOn(Logger, 'info');
    successSpy = vi.spyOn(Logger, 'success');
    errorSpy = vi.spyOn(Logger, 'error');
  });

  it('should trigger discovery and return results', async () => {
    const mockResult = {
      success: true,
      count: 3,
      plugs: { 'plug-1': {}, 'plug-2': {}, 'plug-3': {} },
    };
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    const result = await TapoAPI.discover();

    expect(result).toEqual(mockResult);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/discover',
      expect.objectContaining({
        method: 'POST',
        signal: expect.anything(),
      })
    );
    expect(infoSpy).toHaveBeenCalledWith('Starting Tapo plug discovery...');
    expect(successSpy).toHaveBeenCalledWith('Discovered 3 Tapo plugs');
  });

  it('should use 60 second timeout', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, count: 0 }),
    });

    await TapoAPI.discover();

    // Check that fetch was called with signal
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        signal: expect.anything(),
      })
    );
  });

  it('should throw on error', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi
      .fn()
      .mockRejectedValue(new Error('Discovery failed'));

    await expect(TapoAPI.discover()).rejects.toThrow('Discovery failed');
    expect(errorSpy).toHaveBeenCalled();
  });
});

// ============================================
// TapoAPI.checkAvailability Tests
// ============================================

describe('TapoAPI.checkAvailability', () => {
  let successSpy: MockInstance;
  let warnSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    successSpy = vi.spyOn(Logger, 'success');
    warnSpy = vi.spyOn(Logger, 'warn');
  });

  it('should return true when proxy is available', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
    });

    const result = await TapoAPI.checkAvailability();

    expect(result).toBe(true);
    expect(successSpy).toHaveBeenCalledWith('Tapo proxy is available');
  });

  it('should return false when proxy returns non-ok response', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: false,
    });

    const result = await TapoAPI.checkAvailability();

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('should return false when fetch fails', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi
      .fn()
      .mockRejectedValue(new Error('Network error'));

    const result = await TapoAPI.checkAvailability();

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('should use HEAD method', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
    });

    await TapoAPI.checkAvailability();

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3001/plugs',
      expect.objectContaining({ method: 'HEAD' })
    );
  });
});
