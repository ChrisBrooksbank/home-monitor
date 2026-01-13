/**
 * Unit tests for shield.ts
 * Tests NVIDIA SHIELD API functions
 */

import { describe, it, expect, vi, beforeEach, type Mock, type MockInstance } from 'vitest';
import type { AppConfig } from '../types';

// ============================================
// Mock Setup - Module mocks before imports
// ============================================

// Mock the helpers module
vi.mock('../utils/helpers', () => ({
  checkProxyAvailability: vi.fn(),
}));

// Now import the module under test and Logger (to spy on)
import { ShieldAPI } from './shield';
import { Logger } from '../utils/logger';
import { checkProxyAvailability } from '../utils/helpers';

// Set up APP_CONFIG global
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
// ShieldAPI.checkAvailability Tests
// ============================================

describe('ShieldAPI.checkAvailability', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should delegate to checkProxyAvailability', async () => {
    vi.mocked(checkProxyAvailability).mockResolvedValue(true);

    const result = await ShieldAPI.checkAvailability();

    expect(result).toBe(true);
    expect(checkProxyAvailability).toHaveBeenCalledWith(
      'http://localhost:8082/health',
      'SHIELD'
    );
  });

  it('should return false when proxy unavailable', async () => {
    vi.mocked(checkProxyAvailability).mockResolvedValue(false);

    const result = await ShieldAPI.checkAvailability();

    expect(result).toBe(false);
  });
});

// ============================================
// ShieldAPI.getApps Tests
// ============================================

describe('ShieldAPI.getApps', () => {
  let errorSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    errorSpy = vi.spyOn(Logger, 'error');
  });

  it('should return apps list on success', async () => {
    const mockApps = {
      apps: [
        { name: 'Netflix', packageName: 'com.netflix.ninja' },
        { name: 'YouTube', packageName: 'com.google.android.youtube' },
      ],
    };
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApps),
    });

    const result = await ShieldAPI.getApps();

    expect(result).toEqual(mockApps);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8082/apps',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should return empty apps on HTTP error', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await ShieldAPI.getApps();

    expect(result).toEqual({ apps: [] });
    expect(errorSpy).toHaveBeenCalled();
  });

  it('should return empty apps on network error', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi
      .fn()
      .mockRejectedValue(new Error('Network error'));

    const result = await ShieldAPI.getApps();

    expect(result).toEqual({ apps: [] });
    expect(errorSpy).toHaveBeenCalled();
  });
});

// ============================================
// ShieldAPI.getInfo Tests
// ============================================

describe('ShieldAPI.getInfo', () => {
  let errorSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    errorSpy = vi.spyOn(Logger, 'error');
  });

  it('should return device info on success', async () => {
    const mockInfo = {
      model: 'SHIELD Android TV',
      version: '9.0.0',
      ip: '192.168.68.80',
    };
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockInfo),
    });

    const result = await ShieldAPI.getInfo();

    expect(result).toEqual(mockInfo);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8082/info',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should return null on HTTP error', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const result = await ShieldAPI.getInfo();

    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('should return null on network error', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi
      .fn()
      .mockRejectedValue(new Error('Network error'));

    const result = await ShieldAPI.getInfo();

    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });
});

// ============================================
// ShieldAPI.launchApp Tests
// ============================================

describe('ShieldAPI.launchApp', () => {
  let infoSpy: MockInstance;
  let successSpy: MockInstance;
  let errorSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    infoSpy = vi.spyOn(Logger, 'info');
    successSpy = vi.spyOn(Logger, 'success');
    errorSpy = vi.spyOn(Logger, 'error');
  });

  it('should launch app and return result', async () => {
    const mockResult = { success: true, message: 'App launched' };
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    const result = await ShieldAPI.launchApp('Netflix');

    expect(result).toEqual(mockResult);
    expect(infoSpy).toHaveBeenCalledWith('Launching Netflix on SHIELD...');
    expect(successSpy).toHaveBeenCalledWith('Netflix launched on SHIELD');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8082/launch',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Name': 'Netflix',
        },
      })
    );
  });

  it('should throw on HTTP error', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Unknown app' }),
    });

    await expect(ShieldAPI.launchApp('InvalidApp')).rejects.toThrow('Unknown app');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('should throw on network error', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi
      .fn()
      .mockRejectedValue(new Error('Connection refused'));

    await expect(ShieldAPI.launchApp('Netflix')).rejects.toThrow('Connection refused');
    expect(errorSpy).toHaveBeenCalled();
  });
});

// ============================================
// ShieldAPI.stop Tests
// ============================================

describe('ShieldAPI.stop', () => {
  let infoSpy: MockInstance;
  let successSpy: MockInstance;
  let errorSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    infoSpy = vi.spyOn(Logger, 'info');
    successSpy = vi.spyOn(Logger, 'success');
    errorSpy = vi.spyOn(Logger, 'error');
  });

  it('should stop app and return result', async () => {
    const mockResult = { success: true, message: 'Returned to home' };
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    const result = await ShieldAPI.stop();

    expect(result).toEqual(mockResult);
    expect(infoSpy).toHaveBeenCalledWith('Stopping SHIELD app...');
    expect(successSpy).toHaveBeenCalledWith('SHIELD returned to home screen');
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8082/stop',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('should throw on HTTP error', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'ADB error' }),
    });

    await expect(ShieldAPI.stop()).rejects.toThrow('ADB error');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('should throw on network error', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi
      .fn()
      .mockRejectedValue(new Error('Connection refused'));

    await expect(ShieldAPI.stop()).rejects.toThrow('Connection refused');
    expect(errorSpy).toHaveBeenCalled();
  });
});
