/**
 * Global test setup for Vitest
 * Provides common mocks and utilities for all tests
 */

import { vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Global Mocks
// ============================================

// Mock APP_CONFIG globally (frontend tests)
globalThis.APP_CONFIG = {
    proxies: {
        sonos: 'http://localhost:3000',
        tapo: 'http://localhost:3001',
        shield: 'http://localhost:8082',
        news: 'http://localhost:3002'
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
        tapoDiscovery: 300000,
        connectionStatus: 30000
    },
    timeouts: {
        proxyCheck: 2000,
        apiRequest: 10000
    },
    retry: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2
    },
    debug: false
};

// Mock Logger globally (frontend tests)
globalThis.Logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    setLevel: vi.fn()
};

// ============================================
// localStorage Mock
// ============================================

const localStorageMock = (() => {
    let store = {};
    return {
        getItem: vi.fn((key) => store[key] || null),
        setItem: vi.fn((key, value) => {
            store[key] = String(value);
        }),
        removeItem: vi.fn((key) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            store = {};
        }),
        get length() {
            return Object.keys(store).length;
        },
        key: vi.fn((index) => Object.keys(store)[index] || null),
        // Helper to inspect store in tests
        _getStore: () => store,
        _setStore: (newStore) => {
            store = newStore;
        }
    };
})();

Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock,
    writable: true
});

// ============================================
// Fetch Mock Helper
// ============================================

/**
 * Create a mock fetch response
 * @param {*} data - Response data (will be JSON stringified)
 * @param {object} options - Response options
 * @returns {Promise<Response>}
 */
export function mockFetchResponse(data, options = {}) {
    const { status = 200, ok = true, headers = {} } = options;
    return Promise.resolve({
        ok,
        status,
        headers: new Headers(headers),
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
        clone: function () {
            return this;
        }
    });
}

/**
 * Create a mock fetch error
 * @param {string} message - Error message
 * @returns {Promise<never>}
 */
export function mockFetchError(message = 'Network error') {
    return Promise.reject(new Error(message));
}

// ============================================
// DOM Mock Helpers
// ============================================

/**
 * Create a mock SVG element with common methods
 * @param {string} tagName - Element tag name
 * @returns {object} Mock element
 */
export function createMockSvgElement(tagName = 'g') {
    const attributes = {};
    const children = [];
    const style = {};

    return {
        tagName,
        attributes,
        children,
        style,
        getAttribute: vi.fn((name) => attributes[name]),
        setAttribute: vi.fn((name, value) => {
            attributes[name] = value;
        }),
        removeAttribute: vi.fn((name) => {
            delete attributes[name];
        }),
        appendChild: vi.fn((child) => {
            children.push(child);
            return child;
        }),
        removeChild: vi.fn((child) => {
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
            contains: vi.fn(() => false)
        },
        textContent: '',
        innerHTML: '',
        ownerSVGElement: {
            createSVGPoint: vi.fn(() => ({ x: 0, y: 0, matrixTransform: vi.fn(() => ({ x: 0, y: 0 })) })),
            getScreenCTM: vi.fn(() => ({ inverse: vi.fn(() => ({})) }))
        }
    };
}

/**
 * Create a mock HTML element
 * @param {string} tagName - Element tag name
 * @returns {object} Mock element
 */
export function createMockElement(tagName = 'div') {
    const element = createMockSvgElement(tagName);
    element.getBoundingClientRect = vi.fn(() => ({
        top: 0,
        left: 0,
        right: 100,
        bottom: 100,
        width: 100,
        height: 100
    }));
    return element;
}

// ============================================
// HTTP Request/Response Mocks (for Node.js proxies)
// ============================================

/**
 * Create a mock HTTP request object
 * @param {object} options - Request options
 * @returns {object} Mock request
 */
export function createMockRequest(options = {}) {
    const { method = 'GET', url = '/', headers = {}, body = '' } = options;
    const listeners = {};

    return {
        method,
        url,
        headers,
        on: vi.fn((event, callback) => {
            listeners[event] = callback;
        }),
        // Helper to simulate data events
        _emit: (event, data) => {
            if (listeners[event]) listeners[event](data);
        },
        _emitBody: () => {
            if (body && listeners.data) listeners.data(body);
            if (listeners.end) listeners.end();
        }
    };
}

/**
 * Create a mock HTTP response object
 * @returns {object} Mock response
 */
export function createMockResponse() {
    const headers = {};
    let statusCode = 200;
    let body = '';

    return {
        writeHead: vi.fn((code, hdrs) => {
            statusCode = code;
            Object.assign(headers, hdrs);
        }),
        setHeader: vi.fn((name, value) => {
            headers[name] = value;
        }),
        getHeader: vi.fn((name) => headers[name]),
        end: vi.fn((data) => {
            body = data;
        }),
        write: vi.fn((data) => {
            body += data;
        }),
        // Helpers for assertions
        _getStatusCode: () => statusCode,
        _getHeaders: () => headers,
        _getBody: () => body,
        _getJson: () => JSON.parse(body)
    };
}

// ============================================
// Timer Utilities
// ============================================

/**
 * Advance timers and flush promises
 * Useful for testing async code with timers
 */
export async function flushPromises() {
    await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Wait for a condition to be true
 * @param {Function} condition - Function that returns boolean
 * @param {number} timeout - Max wait time in ms
 * @param {number} interval - Check interval in ms
 */
export async function waitFor(condition, timeout = 1000, interval = 50) {
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
    localStorage.clear();

    // Reset Logger mocks (only if they exist and are mock functions)
    if (Logger?.debug?.mockClear) Logger.debug.mockClear();
    if (Logger?.info?.mockClear) Logger.info.mockClear();
    if (Logger?.warn?.mockClear) Logger.warn.mockClear();
    if (Logger?.error?.mockClear) Logger.error.mockClear();
    if (Logger?.success?.mockClear) Logger.success.mockClear();
});

afterEach(() => {
    // Restore any spies
    vi.restoreAllMocks();
});

// ============================================
// Exports
// ============================================

export { vi };
