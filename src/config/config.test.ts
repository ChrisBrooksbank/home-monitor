/**
 * Unit tests for config constants
 * Tests centralized configuration values
 */

import { describe, it, expect } from 'vitest';
import { APP_CONFIG } from './constants';

// ============================================
// Structure Tests
// ============================================

describe('APP_CONFIG structure', () => {
  it('should have proxies section', () => {
    expect(APP_CONFIG.proxies).toBeDefined();
    expect(typeof APP_CONFIG.proxies).toBe('object');
  });

  it('should have intervals section', () => {
    expect(APP_CONFIG.intervals).toBeDefined();
    expect(typeof APP_CONFIG.intervals).toBe('object');
  });

  it('should have timeouts section', () => {
    expect(APP_CONFIG.timeouts).toBeDefined();
    expect(typeof APP_CONFIG.timeouts).toBe('object');
  });

  it('should have retry section', () => {
    expect(APP_CONFIG.retry).toBeDefined();
    expect(typeof APP_CONFIG.retry).toBe('object');
  });

  it('should have debug flag', () => {
    expect(typeof APP_CONFIG.debug).toBe('boolean');
  });
});

// ============================================
// Proxies Tests
// ============================================

describe('APP_CONFIG.proxies', () => {
  it('should have sonos proxy URL', () => {
    expect(APP_CONFIG.proxies.sonos).toBeDefined();
    expect(APP_CONFIG.proxies.sonos).toMatch(/^http:\/\/localhost:\d+$/);
  });

  it('should have tapo proxy URL', () => {
    expect(APP_CONFIG.proxies.tapo).toBeDefined();
    expect(APP_CONFIG.proxies.tapo).toMatch(/^http:\/\/localhost:\d+$/);
  });

  it('should have shield proxy URL', () => {
    expect(APP_CONFIG.proxies.shield).toBeDefined();
    expect(APP_CONFIG.proxies.shield).toMatch(/^http:\/\/localhost:\d+$/);
  });

  it('should use different ports for each proxy', () => {
    const ports = [
      APP_CONFIG.proxies.sonos,
      APP_CONFIG.proxies.tapo,
      APP_CONFIG.proxies.shield,
    ].map((url) => url.split(':').pop());

    const uniquePorts = new Set(ports);
    expect(uniquePorts.size).toBe(ports.length);
  });
});

// ============================================
// Intervals Tests
// ============================================

describe('APP_CONFIG.intervals', () => {
  it('should have positive motionSensors interval', () => {
    expect(APP_CONFIG.intervals.motionSensors).toBeGreaterThan(0);
  });

  it('should have positive lights interval', () => {
    expect(APP_CONFIG.intervals.lights).toBeGreaterThan(0);
  });

  it('should have positive temperatures interval', () => {
    expect(APP_CONFIG.intervals.temperatures).toBeGreaterThan(0);
  });

  it('should have positive weather interval', () => {
    expect(APP_CONFIG.intervals.weather).toBeGreaterThan(0);
  });

  it('should have positive nest interval', () => {
    expect(APP_CONFIG.intervals.nest).toBeGreaterThan(0);
  });

  it('should have positive sonosVolume interval', () => {
    expect(APP_CONFIG.intervals.sonosVolume).toBeGreaterThan(0);
  });

  it('should have positive tapoStatus interval', () => {
    expect(APP_CONFIG.intervals.tapoStatus).toBeGreaterThan(0);
  });

  it('should have reasonable interval values (not too small)', () => {
    // Intervals should be at least 1 second to avoid hammering APIs
    expect(APP_CONFIG.intervals.motionSensors).toBeGreaterThanOrEqual(1000);
    expect(APP_CONFIG.intervals.lights).toBeGreaterThanOrEqual(1000);
  });

  it('should have reasonable interval values (not too large)', () => {
    // Most intervals should be less than 1 hour
    const oneHour = 60 * 60 * 1000;
    expect(APP_CONFIG.intervals.weather).toBeLessThanOrEqual(oneHour);
    expect(APP_CONFIG.intervals.nest).toBeLessThanOrEqual(oneHour);
  });
});

// ============================================
// Timeouts Tests
// ============================================

describe('APP_CONFIG.timeouts', () => {
  it('should have positive proxyCheck timeout', () => {
    expect(APP_CONFIG.timeouts.proxyCheck).toBeGreaterThan(0);
  });

  it('should have positive apiRequest timeout', () => {
    expect(APP_CONFIG.timeouts.apiRequest).toBeGreaterThan(0);
  });

  it('should have apiRequest timeout greater than proxyCheck', () => {
    expect(APP_CONFIG.timeouts.apiRequest).toBeGreaterThan(APP_CONFIG.timeouts.proxyCheck);
  });

  it('should have reasonable timeout values', () => {
    // Timeouts should be between 1 second and 30 seconds
    expect(APP_CONFIG.timeouts.proxyCheck).toBeGreaterThanOrEqual(1000);
    expect(APP_CONFIG.timeouts.proxyCheck).toBeLessThanOrEqual(30000);
    expect(APP_CONFIG.timeouts.apiRequest).toBeGreaterThanOrEqual(1000);
    expect(APP_CONFIG.timeouts.apiRequest).toBeLessThanOrEqual(30000);
  });
});

// ============================================
// Retry Configuration Tests
// ============================================

describe('APP_CONFIG.retry', () => {
  it('should have positive maxAttempts', () => {
    expect(APP_CONFIG.retry.maxAttempts).toBeGreaterThan(0);
  });

  it('should have positive initialDelay', () => {
    expect(APP_CONFIG.retry.initialDelay).toBeGreaterThan(0);
  });

  it('should have positive maxDelay', () => {
    expect(APP_CONFIG.retry.maxDelay).toBeGreaterThan(0);
  });

  it('should have maxDelay greater than initialDelay', () => {
    expect(APP_CONFIG.retry.maxDelay).toBeGreaterThan(APP_CONFIG.retry.initialDelay);
  });

  it('should have positive backoffMultiplier', () => {
    expect(APP_CONFIG.retry.backoffMultiplier).toBeGreaterThan(1);
  });

  it('should have reasonable retry values', () => {
    // Max attempts should be between 1 and 10
    expect(APP_CONFIG.retry.maxAttempts).toBeGreaterThanOrEqual(1);
    expect(APP_CONFIG.retry.maxAttempts).toBeLessThanOrEqual(10);
  });
});

// ============================================
// Value Type Tests
// ============================================

describe('APP_CONFIG value types', () => {
  it('all interval values should be numbers', () => {
    Object.values(APP_CONFIG.intervals).forEach((value) => {
      expect(typeof value).toBe('number');
    });
  });

  it('all timeout values should be numbers', () => {
    Object.values(APP_CONFIG.timeouts).forEach((value) => {
      expect(typeof value).toBe('number');
    });
  });

  it('all retry values should be numbers', () => {
    Object.values(APP_CONFIG.retry).forEach((value) => {
      expect(typeof value).toBe('number');
    });
  });

  it('all proxy values should be strings', () => {
    Object.values(APP_CONFIG.proxies).forEach((value) => {
      expect(typeof value).toBe('string');
    });
  });
});
