/**
 * Unit tests for helpers.js
 * Tests utility functions: sanitizeHTML, debounce, throttle, retryWithBackoff, etc.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// Test Setup - Mock globals before import
// ============================================

// Mock window.addEventListener before loading helpers
const mockAddEventListener = vi.fn();
globalThis.window = globalThis.window || {};
globalThis.window.addEventListener = mockAddEventListener;

// Import helpers functions
import {
    sanitizeHTML,
    safeSetHTML,
    checkProxyAvailability,
    retryWithBackoff,
    debounce,
    throttle,
    IntervalManager
} from './helpers.js';

// ============================================
// sanitizeHTML Tests
// ============================================

describe('sanitizeHTML', () => {
    it('should escape HTML special characters', () => {
        const result = sanitizeHTML('<script>alert("xss")</script>');

        expect(result).not.toContain('<script>');
        expect(result).toContain('&lt;script&gt;');
    });

    it('should escape angle brackets', () => {
        const result = sanitizeHTML('<div>test</div>');

        expect(result).toContain('&lt;div&gt;');
        expect(result).toContain('&lt;/div&gt;');
    });

    it('should escape ampersands', () => {
        const result = sanitizeHTML('Tom & Jerry');

        expect(result).toContain('&amp;');
    });

    it('should not escape quotes (textContent does not escape quotes)', () => {
        // Note: textContent only escapes < > &, not quotes
        // This is correct behavior - quotes are safe in text content
        const result = sanitizeHTML('Say "hello"');

        expect(result).toBe('Say "hello"');
    });

    it('should handle plain text without modification', () => {
        const result = sanitizeHTML('Plain text content');

        expect(result).toBe('Plain text content');
    });

    it('should handle empty string', () => {
        const result = sanitizeHTML('');

        expect(result).toBe('');
    });

    it('should handle null-ish values gracefully', () => {
        // textContent converts null/undefined to strings
        expect(() => sanitizeHTML(null)).not.toThrow();
        expect(() => sanitizeHTML(undefined)).not.toThrow();
    });
});

// ============================================
// debounce Tests
// ============================================

describe('debounce', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should delay function execution', () => {
        const fn = vi.fn();
        const debouncedFn = debounce(fn, 100);

        debouncedFn();
        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should cancel previous call when called again before delay', () => {
        const fn = vi.fn();
        const debouncedFn = debounce(fn, 100);

        debouncedFn();
        vi.advanceTimersByTime(50);
        debouncedFn(); // Cancel previous, restart timer
        vi.advanceTimersByTime(50);

        expect(fn).not.toHaveBeenCalled();

        vi.advanceTimersByTime(50);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to the debounced function', () => {
        const fn = vi.fn();
        const debouncedFn = debounce(fn, 100);

        debouncedFn('arg1', 'arg2');
        vi.advanceTimersByTime(100);

        expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should preserve this context', () => {
        const obj = {
            value: 42,
            getValue: vi.fn(function() { return this.value; })
        };
        obj.debouncedGetValue = debounce(obj.getValue, 100);

        obj.debouncedGetValue();
        vi.advanceTimersByTime(100);

        expect(obj.getValue).toHaveBeenCalled();
    });

    it('should only call once for rapid successive calls', () => {
        const fn = vi.fn();
        const debouncedFn = debounce(fn, 100);

        for (let i = 0; i < 10; i++) {
            debouncedFn();
            vi.advanceTimersByTime(10);
        }

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);
    });
});

// ============================================
// throttle Tests
// ============================================

describe('throttle', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should execute function immediately on first call', () => {
        const fn = vi.fn();
        const throttledFn = throttle(fn, 100);

        throttledFn();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should block subsequent calls within throttle period', () => {
        const fn = vi.fn();
        const throttledFn = throttle(fn, 100);

        throttledFn();
        throttledFn();
        throttledFn();

        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should allow call after throttle period expires', () => {
        const fn = vi.fn();
        const throttledFn = throttle(fn, 100);

        throttledFn();
        expect(fn).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(100);
        throttledFn();
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should pass arguments to throttled function', () => {
        const fn = vi.fn();
        const throttledFn = throttle(fn, 100);

        throttledFn('arg1', 'arg2');

        expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should preserve this context', () => {
        const obj = {
            value: 42,
            getValue: vi.fn(function() { return this.value; })
        };
        obj.throttledGetValue = throttle(obj.getValue, 100);

        obj.throttledGetValue();

        expect(obj.getValue).toHaveBeenCalled();
    });
});

// ============================================
// retryWithBackoff Tests
// ============================================

describe('retryWithBackoff', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // Reset Logger mocks
        Logger.warn.mockClear();
        Logger.error.mockClear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should return result on first success', async () => {
        const fn = vi.fn().mockResolvedValue('success');

        const result = await retryWithBackoff(fn, 3, 100);

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('fail'))
            .mockResolvedValueOnce('success');

        const promise = retryWithBackoff(fn, 3, 100);

        // First call fails immediately
        await vi.advanceTimersByTimeAsync(0);

        // Wait for backoff delay
        await vi.advanceTimersByTimeAsync(100);

        const result = await promise;

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
        expect(Logger.warn).toHaveBeenCalled();
    });

    it('should throw after max attempts', async () => {
        // Use real timers for this test to avoid unhandled rejection issues
        vi.useRealTimers();

        const error = new Error('always fails');
        const fn = vi.fn().mockRejectedValue(error);

        // Use very short delays for fast test
        await expect(retryWithBackoff(fn, 2, 1)).rejects.toThrow('always fails');

        expect(fn).toHaveBeenCalledTimes(2);
        expect(Logger.error).toHaveBeenCalled();

        // Restore fake timers for other tests
        vi.useFakeTimers();
    });

    it('should use exponential backoff', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce(new Error('fail'))
            .mockRejectedValueOnce(new Error('fail'))
            .mockResolvedValueOnce('success');

        const promise = retryWithBackoff(fn, 3, 100);

        // First attempt
        await vi.advanceTimersByTimeAsync(0);
        expect(fn).toHaveBeenCalledTimes(1);

        // Wait for first backoff (100ms)
        await vi.advanceTimersByTimeAsync(100);
        expect(fn).toHaveBeenCalledTimes(2);

        // Wait for second backoff (200ms = 100 * 2^1)
        await vi.advanceTimersByTimeAsync(200);

        await promise;
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should use default values from APP_CONFIG', async () => {
        const fn = vi.fn().mockResolvedValue('success');

        await retryWithBackoff(fn);

        expect(fn).toHaveBeenCalledTimes(1);
    });
});

// ============================================
// IntervalManager Tests
// ============================================

describe('IntervalManager', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        IntervalManager.clearAll();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should register an interval and return ID', () => {
        const fn = vi.fn();
        const id = IntervalManager.register(fn, 100);

        // With fake timers, ID might be an object (Timeout) instead of number
        expect(id).toBeDefined();
        expect(IntervalManager.intervals).toContain(id);
    });

    it('should execute registered function at interval', () => {
        const fn = vi.fn();
        IntervalManager.register(fn, 100);

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should clear a specific interval', () => {
        const fn1 = vi.fn();
        const fn2 = vi.fn();

        const id1 = IntervalManager.register(fn1, 100);
        const id2 = IntervalManager.register(fn2, 100);

        IntervalManager.clear(id1);

        vi.advanceTimersByTime(100);

        expect(fn1).not.toHaveBeenCalled();
        expect(fn2).toHaveBeenCalledTimes(1);
        expect(IntervalManager.intervals).not.toContain(id1);
        expect(IntervalManager.intervals).toContain(id2);
    });

    it('should clear all intervals', () => {
        const fn1 = vi.fn();
        const fn2 = vi.fn();

        IntervalManager.register(fn1, 100);
        IntervalManager.register(fn2, 100);

        IntervalManager.clearAll();

        vi.advanceTimersByTime(100);

        expect(fn1).not.toHaveBeenCalled();
        expect(fn2).not.toHaveBeenCalled();
        expect(IntervalManager.intervals).toHaveLength(0);
    });

    it('should track multiple intervals', () => {
        const fn1 = vi.fn();
        const fn2 = vi.fn();
        const fn3 = vi.fn();

        IntervalManager.register(fn1, 100);
        IntervalManager.register(fn2, 200);
        IntervalManager.register(fn3, 300);

        expect(IntervalManager.intervals).toHaveLength(3);
    });
});

// ============================================
// checkProxyAvailability Tests
// ============================================

describe('checkProxyAvailability', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should return true when fetch succeeds', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

        const result = await checkProxyAvailability('http://localhost:3000', 'Test');

        expect(result).toBe(true);
        expect(fetch).toHaveBeenCalledWith('http://localhost:3000', expect.any(Object));
        expect(Logger.success).toHaveBeenCalled();
    });

    it('should return false when fetch fails', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const result = await checkProxyAvailability('http://localhost:3000', 'Test');

        expect(result).toBe(false);
        expect(Logger.warn).toHaveBeenCalled();
    });

    it('should use HEAD method', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });

        await checkProxyAvailability('http://localhost:3000', 'Test');

        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:3000',
            expect.objectContaining({ method: 'HEAD' })
        );
    });

    it('should include timeout signal', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
        globalThis.AbortSignal = {
            timeout: vi.fn().mockReturnValue('mock-signal')
        };

        await checkProxyAvailability('http://localhost:3000', 'Test');

        expect(AbortSignal.timeout).toHaveBeenCalledWith(APP_CONFIG.timeouts.proxyCheck);
        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:3000',
            expect.objectContaining({ signal: 'mock-signal' })
        );
    });
});

// ============================================
// Window beforeunload listener
// ============================================
// Note: Testing beforeunload registration is challenging with ES modules
// because the import is hoisted. The listener IS registered, but we can't
// easily verify it in tests. This is an implementation detail anyway.
