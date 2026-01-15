/**
 * Registry Test Helpers
 * Utilities for mocking services via the Registry in tests
 */

import { vi, type Mock } from 'vitest';
import { Registry, type ServiceKey, type ServiceMap } from '../core/registry';

// =============================================================================
// TEST CONTEXT
// =============================================================================

export interface TestContext {
  /**
   * Mock a service in the Registry
   * @param key - Service key to mock
   * @param implementation - Partial implementation (missing methods will be vi.fn())
   */
  mock<K extends ServiceKey>(key: K, implementation: Partial<ServiceMap[K]>): void;

  /**
   * Restore the Registry to its original state
   */
  restore(): void;

  /**
   * Get a mocked service
   */
  getMock<K extends ServiceKey>(key: K): ServiceMap[K];
}

/**
 * Create a test context that tracks Registry changes and can restore them
 *
 * @example
 * ```typescript
 * const ctx = createTestContext();
 *
 * beforeEach(() => {
 *   ctx.mock('HUE_CONFIG', { BRIDGE_IP: '192.168.1.1', USERNAME: 'test' });
 *   ctx.mock('AppEvents', { emit: vi.fn(), on: vi.fn() });
 * });
 *
 * afterEach(() => {
 *   ctx.restore();
 * });
 * ```
 */
export function createTestContext(): TestContext {
  const mocks = new Map<ServiceKey, unknown>();

  return {
    mock<K extends ServiceKey>(key: K, implementation: Partial<ServiceMap[K]>): void {
      const mock = createMock(key, implementation);
      mocks.set(key, mock);
      Registry.replace(key, mock);
    },

    restore(): void {
      Registry.clear();
      mocks.clear();
    },

    getMock<K extends ServiceKey>(key: K): ServiceMap[K] {
      return mocks.get(key) as ServiceMap[K];
    },
  };
}

// =============================================================================
// MOCK FACTORIES
// =============================================================================

/**
 * Create a mock for a specific service
 * Provides sensible defaults that can be overridden
 *
 * @param key - Service key
 * @param overrides - Partial implementation to merge with defaults
 */
export function createMock<K extends ServiceKey>(
  key: K,
  overrides: Partial<ServiceMap[K]> = {}
): ServiceMap[K] {
  const defaults = getDefaultMock(key);
  return { ...defaults, ...overrides } as ServiceMap[K];
}

/**
 * Get default mock implementation for a service
 */
function getDefaultMock(key: ServiceKey): unknown {
  switch (key) {
    case 'AppEvents':
      return createMockAppEvents();
    case 'AppState':
      return createMockAppState();
    case 'Poller':
      return createMockPoller();
    case 'ConnectionMonitor':
      return createMockConnectionMonitor();
    case 'HueAPI':
      return createMockHueAPI();
    case 'SonosAPI':
      return createMockSonosAPI();
    case 'TapoAPI':
      return createMockTapoAPI();
    case 'IntervalManager':
      return createMockIntervalManager();
    case 'APP_CONFIG':
      return createMockAppConfig();
    case 'HUE_CONFIG':
      return createMockHueConfig();
    case 'WEATHER_CONFIG':
      return createMockWeatherConfig();
    case 'NEST_CONFIG':
      return createMockNestConfig();
    default:
      return {};
  }
}

// =============================================================================
// SPECIFIC MOCK IMPLEMENTATIONS
// =============================================================================

export function createMockAppEvents(): {
  on: Mock;
  off: Mock;
  once: Mock;
  emit: Mock;
  clear: Mock;
  waitFor: Mock;
} {
  return {
    on: vi.fn(() => () => {}),
    off: vi.fn(),
    once: vi.fn(() => () => {}),
    emit: vi.fn(() => 0),
    clear: vi.fn(),
    waitFor: vi.fn(() => Promise.resolve(undefined)),
  };
}

export function createMockAppState(): {
  get: Mock;
  set: Mock;
  update: Mock;
  push: Mock;
  remove: Mock;
  setMany: Mock;
  subscribe: Mock;
  getHistory: Mock;
} {
  const store: Record<string, unknown> = {};
  return {
    get: vi.fn((key: string) => store[key]),
    set: vi.fn((key: string, value: unknown) => {
      store[key] = value;
    }),
    update: vi.fn(),
    push: vi.fn(),
    remove: vi.fn(),
    setMany: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    getHistory: vi.fn(() => []),
  };
}

export function createMockPoller(): {
  register: Mock;
  start: Mock;
  stop: Mock;
  getStatus: Mock;
  setEnabled: Mock;
} {
  return {
    register: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    getStatus: vi.fn(() => []),
    setEnabled: vi.fn(),
  };
}

export function createMockConnectionMonitor(): {
  check: Mock;
  getStatus: Mock;
  start: Mock;
  stop: Mock;
} {
  return {
    check: vi.fn(() => Promise.resolve(true)),
    getStatus: vi.fn(() => ({
      hue: { online: true, lastCheck: new Date() },
      sonos: { online: true, lastCheck: new Date() },
      tapo: { online: true, lastCheck: new Date() },
      shield: { online: true, lastCheck: new Date() },
    })),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

export function createMockHueAPI(): {
  getAllLights: Mock;
  getLight: Mock;
  setLightState: Mock;
  toggleLight: Mock;
  getAllSensors: Mock;
  getBridgeConfig: Mock;
} {
  return {
    getAllLights: vi.fn(() => Promise.resolve({})),
    getLight: vi.fn(() => Promise.resolve(null)),
    setLightState: vi.fn(() => Promise.resolve(true)),
    toggleLight: vi.fn(() => Promise.resolve(true)),
    getAllSensors: vi.fn(() => Promise.resolve({})),
    getBridgeConfig: vi.fn(() => Promise.resolve(null)),
  };
}

export function createMockSonosAPI(): {
  discover: Mock;
  getSpeakers: Mock;
  play: Mock;
  pause: Mock;
  setVolume: Mock;
  getVolume: Mock;
} {
  return {
    discover: vi.fn(() => Promise.resolve({ speakers: {}, count: 0 })),
    getSpeakers: vi.fn(() => Promise.resolve({ speakers: {} })),
    play: vi.fn(() => Promise.resolve({ ok: true })),
    pause: vi.fn(() => Promise.resolve({ ok: true })),
    setVolume: vi.fn(() => Promise.resolve({ ok: true })),
    getVolume: vi.fn(() => Promise.resolve(50)),
  };
}

export function createMockTapoAPI(): {
  discover: Mock;
  getPlugs: Mock;
  getStatus: Mock;
  toggle: Mock;
  turnOn: Mock;
  turnOff: Mock;
} {
  return {
    discover: vi.fn(() => Promise.resolve({ plugs: {}, count: 0 })),
    getPlugs: vi.fn(() => Promise.resolve({ plugs: {} })),
    getStatus: vi.fn(() => Promise.resolve({ state: 'off' })),
    toggle: vi.fn(() => Promise.resolve({ success: true, state: 'on' })),
    turnOn: vi.fn(() => Promise.resolve({ success: true })),
    turnOff: vi.fn(() => Promise.resolve({ success: true })),
  };
}

export function createMockIntervalManager(): {
  register: Mock;
  clear: Mock;
  clearAll: Mock;
  getCount: Mock;
} {
  return {
    register: vi.fn(() => 1),
    clear: vi.fn(),
    clearAll: vi.fn(),
    getCount: vi.fn(() => 0),
  };
}

export function createMockAppConfig() {
  return {
    proxies: {
      sonos: 'http://localhost:3000',
      tapo: 'http://localhost:3001',
      shield: 'http://localhost:8082',
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
    debug: false,
  };
}

export function createMockHueConfig() {
  return {
    BRIDGE_IP: '192.168.68.51',
    USERNAME: 'test-user-12345',
  };
}

export function createMockWeatherConfig() {
  return {
    API_KEY: 'test-weather-api-key',
    LOCATION: 'London,UK',
  };
}

export function createMockNestConfig() {
  return {
    CLIENT_ID: 'test-client-id',
    CLIENT_SECRET: 'test-client-secret',
    PROJECT_ID: 'test-project-id',
    REDIRECT_URI: 'http://localhost:8080/auth/callback',
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Setup Registry with common test mocks
 * Call in beforeEach for quick setup
 */
export function setupTestRegistry(): void {
  Registry.replace('APP_CONFIG', createMockAppConfig());
  Registry.replace('AppEvents', createMockAppEvents());
  Registry.replace('AppState', createMockAppState());
}

/**
 * Clear the Registry
 * Call in afterEach for cleanup
 */
export function clearTestRegistry(): void {
  Registry.clear();
}
