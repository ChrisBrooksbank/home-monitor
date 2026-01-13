/**
 * Global test setup for Vitest
 * Provides common mocks and utilities for all tests
 */

import { vi, beforeEach, afterEach, type Mock } from 'vitest';
import type { AppConfig, LogLevel, LogLevels } from '../types';

// ============================================
// Type Definitions
// ============================================

export interface MockLoggerType {
  debug: Mock;
  info: Mock;
  warn: Mock;
  error: Mock;
  success: Mock;
  setLevel: Mock;
  levels: LogLevels;
  currentLevel: number;
}

export interface MockLocalStorage {
  getItem: Mock<[string], string | null>;
  setItem: Mock<[string, string], void>;
  removeItem: Mock<[string], void>;
  clear: Mock<[], void>;
  length: number;
  key: Mock<[number], string | null>;
  _getStore: () => Record<string, string>;
  _setStore: (newStore: Record<string, string>) => void;
}

export interface MockResponseOptions {
  status?: number;
  ok?: boolean;
  headers?: Record<string, string>;
}

export interface MockResponse {
  ok: boolean;
  status: number;
  headers: Headers;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
  clone: () => MockResponse;
}

export interface MockSvgElement {
  tagName: string;
  attributes: Record<string, string>;
  children: MockSvgElement[];
  style: Record<string, string>;
  getAttribute: Mock<[string], string | undefined>;
  setAttribute: Mock<[string, string], void>;
  removeAttribute: Mock<[string], void>;
  appendChild: Mock<[MockSvgElement], MockSvgElement>;
  removeChild: Mock<[MockSvgElement], MockSvgElement>;
  remove: Mock;
  querySelector: Mock;
  querySelectorAll: Mock<[], MockSvgElement[]>;
  addEventListener: Mock;
  removeEventListener: Mock;
  dispatchEvent: Mock;
  classList: {
    add: Mock;
    remove: Mock;
    toggle: Mock;
    contains: Mock<[], boolean>;
  };
  textContent: string;
  innerHTML: string;
  ownerSVGElement: {
    createSVGPoint: Mock;
    getScreenCTM: Mock;
  };
  getBoundingClientRect?: Mock;
}

export interface MockRequestOptions {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface MockRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  on: Mock<[string, (data?: unknown) => void], MockRequest>;
  _emit: (event: string, data?: unknown) => void;
  _emitBody: () => void;
}

export interface MockHttpResponse {
  writeHead: Mock<[number, Record<string, string>?], void>;
  setHeader: Mock<[string, string], void>;
  getHeader: Mock<[string], string | undefined>;
  end: Mock<[string?], void>;
  write: Mock<[string], void>;
  _getStatusCode: () => number;
  _getHeaders: () => Record<string, string>;
  _getBody: () => string;
  _getJson: () => unknown;
}

// ============================================
// Global Window Alias
// ============================================
// Create window alias so source files that use `window.X = X` work in Node
// This must come before any source imports
(globalThis as typeof globalThis & { window: typeof globalThis }).window = globalThis;

// ============================================
// Global Mocks
// ============================================

// Mock APP_CONFIG globally (frontend tests)
const mockAppConfig: AppConfig = {
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

(globalThis as typeof globalThis & { APP_CONFIG: AppConfig }).APP_CONFIG = mockAppConfig;

// Mock Logger globally (frontend tests)
const mockLogger: MockLoggerType = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  success: vi.fn(),
  setLevel: vi.fn(),
  levels: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 },
  currentLevel: 0,
};

(globalThis as typeof globalThis & { Logger: MockLoggerType }).Logger = mockLogger;

// ============================================
// localStorage Mock
// ============================================

const localStorageMock = ((): MockLocalStorage => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string): string | null => store[key] || null),
    setItem: vi.fn((key: string, value: string): void => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key: string): void => {
      delete store[key];
    }),
    clear: vi.fn((): void => {
      store = {};
    }),
    get length(): number {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number): string | null => Object.keys(store)[index] || null),
    // Helper to inspect store in tests
    _getStore: (): Record<string, string> => store,
    _setStore: (newStore: Record<string, string>): void => {
      store = newStore;
    },
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// ============================================
// Fetch Mock Helper
// ============================================

/**
 * Create a mock fetch response
 * @param data - Response data (will be JSON stringified)
 * @param options - Response options
 * @returns Promise<MockResponse>
 */
export function mockFetchResponse(
  data: unknown,
  options: MockResponseOptions = {}
): Promise<MockResponse> {
  const { status = 200, ok = true, headers = {} } = options;
  const response: MockResponse = {
    ok,
    status,
    headers: new Headers(headers),
    json: () => Promise.resolve(data),
    text: () =>
      Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
    clone: function (): MockResponse {
      return this;
    },
  };
  return Promise.resolve(response);
}

/**
 * Create a mock fetch error
 * @param message - Error message
 * @returns Promise<never>
 */
export function mockFetchError(message = 'Network error'): Promise<never> {
  return Promise.reject(new Error(message));
}

// ============================================
// DOM Mock Helpers
// ============================================

/**
 * Create a mock SVG element with common methods
 * @param tagName - Element tag name
 * @returns Mock element
 */
export function createMockSvgElement(tagName = 'g'): MockSvgElement {
  const attributes: Record<string, string> = {};
  const children: MockSvgElement[] = [];
  const style: Record<string, string> = {};

  return {
    tagName,
    attributes,
    children,
    style,
    getAttribute: vi.fn((name: string) => attributes[name]),
    setAttribute: vi.fn((name: string, value: string) => {
      attributes[name] = value;
    }),
    removeAttribute: vi.fn((name: string) => {
      delete attributes[name];
    }),
    appendChild: vi.fn((child: MockSvgElement) => {
      children.push(child);
      return child;
    }),
    removeChild: vi.fn((child: MockSvgElement) => {
      const index = children.indexOf(child);
      if (index > -1) children.splice(index, 1);
      return child;
    }),
    remove: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      toggle: vi.fn(),
      contains: vi.fn(() => false),
    },
    textContent: '',
    innerHTML: '',
    ownerSVGElement: {
      createSVGPoint: vi.fn(() => ({
        x: 0,
        y: 0,
        matrixTransform: vi.fn(() => ({ x: 0, y: 0 })),
      })),
      getScreenCTM: vi.fn(() => ({ inverse: vi.fn(() => ({})) })),
    },
  };
}

/**
 * Create a mock HTML element
 * @param tagName - Element tag name
 * @returns Mock element
 */
export function createMockElement(tagName = 'div'): MockSvgElement {
  const element = createMockSvgElement(tagName);
  element.getBoundingClientRect = vi.fn(() => ({
    top: 0,
    left: 0,
    right: 100,
    bottom: 100,
    width: 100,
    height: 100,
  }));
  return element;
}

// ============================================
// HTTP Request/Response Mocks (for Node.js proxies)
// ============================================

/**
 * Create a mock HTTP request object
 * @param options - Request options
 * @returns Mock request
 */
export function createMockRequest(options: MockRequestOptions = {}): MockRequest {
  const { method = 'GET', url = '/', headers = {}, body = '' } = options;
  const listeners: Record<string, (data?: unknown) => void> = {};

  const req: MockRequest = {
    method,
    url,
    headers,
    on: vi.fn((event: string, callback: (data?: unknown) => void) => {
      listeners[event] = callback;
      return req;
    }),
    // Helper to simulate data events
    _emit: (event: string, data?: unknown): void => {
      if (listeners[event]) listeners[event](data);
    },
    _emitBody: (): void => {
      if (body && listeners.data) listeners.data(body);
      if (listeners.end) listeners.end();
    },
  };
  return req;
}

/**
 * Create a mock HTTP response object
 * @returns Mock response
 */
export function createMockResponse(): MockHttpResponse {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body = '';

  return {
    writeHead: vi.fn((code: number, hdrs?: Record<string, string>) => {
      statusCode = code;
      if (hdrs) Object.assign(headers, hdrs);
    }),
    setHeader: vi.fn((name: string, value: string) => {
      headers[name] = value;
    }),
    getHeader: vi.fn((name: string) => headers[name]),
    end: vi.fn((data?: string) => {
      if (data) body = data;
    }),
    write: vi.fn((data: string) => {
      body += data;
    }),
    // Helpers for assertions
    _getStatusCode: () => statusCode,
    _getHeaders: () => headers,
    _getBody: () => body,
    _getJson: () => JSON.parse(body),
  };
}

// ============================================
// Timer Utilities
// ============================================

/**
 * Advance timers and flush promises
 * Useful for testing async code with timers
 */
export async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Wait for a condition to be true
 * @param condition - Function that returns boolean
 * @param timeout - Max wait time in ms
 * @param interval - Check interval in ms
 */
export async function waitFor(
  condition: () => boolean,
  timeout = 1000,
  interval = 50
): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) {
      throw new Error('waitFor timeout');
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

// ============================================
// Test Lifecycle Hooks
// ============================================

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();

  // Reset localStorage
  localStorageMock.clear();

  // Reset Logger mocks (only if they exist and are mock functions)
  const globalLogger = (globalThis as typeof globalThis & { Logger: MockLoggerType }).Logger;
  if (globalLogger?.debug?.mockClear) globalLogger.debug.mockClear();
  if (globalLogger?.info?.mockClear) globalLogger.info.mockClear();
  if (globalLogger?.warn?.mockClear) globalLogger.warn.mockClear();
  if (globalLogger?.error?.mockClear) globalLogger.error.mockClear();
  if (globalLogger?.success?.mockClear) globalLogger.success.mockClear();
});

afterEach(() => {
  // Restore any spies
  vi.restoreAllMocks();
});

// ============================================
// Exports
// ============================================

export { vi };

// Re-export types for convenience
export type { AppConfig, LogLevel, LogLevels };
