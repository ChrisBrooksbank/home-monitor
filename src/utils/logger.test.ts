/**
 * Unit tests for logger.ts
 * Tests centralized logging utility
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { Logger } from './logger';
import type { AppConfig } from '../types';

// ============================================
// Mock Setup
// ============================================

// Save original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

// Mock APP_CONFIG
(globalThis as typeof globalThis & { APP_CONFIG: Partial<AppConfig> }).APP_CONFIG = {
  debug: true,
};

// ============================================
// Logger._timestamp Tests
// ============================================

describe('Logger._timestamp', () => {
  it('should return time in HH:MM:SS.mmm format', () => {
    const timestamp = Logger._timestamp();

    // Should match pattern like "12:34:56.789"
    expect(timestamp).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it('should return 12 character string', () => {
    const timestamp = Logger._timestamp();

    expect(timestamp).toHaveLength(12);
  });
});

// ============================================
// Logger._format Tests
// ============================================

describe('Logger._format', () => {
  it('should format message with timestamp and emoji', () => {
    const formatted = Logger._format('INFO', '\u2139\uFE0F', 'Test message');

    expect(formatted).toHaveLength(2);
    expect(formatted[0]).toMatch(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\] \u2139\uFE0F INFO:$/);
    expect(formatted[1]).toBe('Test message');
  });

  it('should include additional arguments', () => {
    const formatted = Logger._format('DEBUG', '\u{1F50D}', 'Message', { extra: 'data' }, 123);

    expect(formatted).toHaveLength(4);
    expect(formatted[2]).toEqual({ extra: 'data' });
    expect(formatted[3]).toBe(123);
  });
});

// ============================================
// Logger.debug Tests
// ============================================

describe('Logger.debug', () => {
  beforeEach(() => {
    console.log = vi.fn();
    Logger.currentLevel = 0; // DEBUG
    (globalThis as typeof globalThis & { APP_CONFIG: Partial<AppConfig> }).APP_CONFIG = { debug: true };
  });

  afterEach(() => {
    console.log = originalConsole.log;
  });

  it('should log when debug mode is enabled', () => {
    Logger.debug('Debug message');

    expect(console.log).toHaveBeenCalled();
    const args = (console.log as Mock).mock.calls[0] as unknown[];
    expect(args[0]).toContain('DEBUG:');
    expect(args[1]).toBe('Debug message');
  });

  it('should not log when debug mode is disabled', () => {
    (globalThis as typeof globalThis & { APP_CONFIG: Partial<AppConfig> }).APP_CONFIG = { debug: false };

    Logger.debug('Debug message');

    expect(console.log).not.toHaveBeenCalled();
  });

  it('should not log when APP_CONFIG is undefined', () => {
    (globalThis as typeof globalThis & { APP_CONFIG?: Partial<AppConfig> }).APP_CONFIG = undefined;

    Logger.debug('Debug message');

    expect(console.log).not.toHaveBeenCalled();
  });

  it('should not log when level is higher than DEBUG', () => {
    Logger.currentLevel = Logger.levels.INFO;

    Logger.debug('Debug message');

    expect(console.log).not.toHaveBeenCalled();
  });
});

// ============================================
// Logger.info Tests
// ============================================

describe('Logger.info', () => {
  beforeEach(() => {
    console.log = vi.fn();
    Logger.currentLevel = 0;
  });

  afterEach(() => {
    console.log = originalConsole.log;
  });

  it('should log info messages', () => {
    Logger.info('Info message');

    expect(console.log).toHaveBeenCalled();
    const args = (console.log as Mock).mock.calls[0] as unknown[];
    expect(args[0]).toContain('INFO:');
    expect(args[1]).toBe('Info message');
  });

  it('should not log when level is higher than INFO', () => {
    Logger.currentLevel = Logger.levels.WARN;

    Logger.info('Info message');

    expect(console.log).not.toHaveBeenCalled();
  });

  it('should include additional arguments', () => {
    Logger.info('Info with data', { key: 'value' });

    const args = (console.log as Mock).mock.calls[0] as unknown[];
    expect(args[2]).toEqual({ key: 'value' });
  });
});

// ============================================
// Logger.warn Tests
// ============================================

describe('Logger.warn', () => {
  beforeEach(() => {
    console.warn = vi.fn();
    Logger.currentLevel = 0;
  });

  afterEach(() => {
    console.warn = originalConsole.warn;
  });

  it('should log warning messages', () => {
    Logger.warn('Warning message');

    expect(console.warn).toHaveBeenCalled();
    const args = (console.warn as Mock).mock.calls[0] as unknown[];
    expect(args[0]).toContain('WARN:');
    expect(args[1]).toBe('Warning message');
  });

  it('should not log when level is higher than WARN', () => {
    Logger.currentLevel = Logger.levels.ERROR;

    Logger.warn('Warning message');

    expect(console.warn).not.toHaveBeenCalled();
  });
});

// ============================================
// Logger.error Tests
// ============================================

describe('Logger.error', () => {
  beforeEach(() => {
    console.error = vi.fn();
    Logger.currentLevel = 0;
  });

  afterEach(() => {
    console.error = originalConsole.error;
  });

  it('should log error messages', () => {
    Logger.error('Error message');

    expect(console.error).toHaveBeenCalled();
    const args = (console.error as Mock).mock.calls[0] as unknown[];
    expect(args[0]).toContain('ERROR:');
    expect(args[1]).toBe('Error message');
  });

  it('should always log when level is ERROR', () => {
    Logger.currentLevel = Logger.levels.ERROR;

    Logger.error('Error message');

    expect(console.error).toHaveBeenCalled();
  });
});

// ============================================
// Logger.success Tests
// ============================================

describe('Logger.success', () => {
  beforeEach(() => {
    console.log = vi.fn();
    Logger.currentLevel = 0;
  });

  afterEach(() => {
    console.log = originalConsole.log;
  });

  it('should log success messages', () => {
    Logger.success('Success message');

    expect(console.log).toHaveBeenCalled();
    const args = (console.log as Mock).mock.calls[0] as unknown[];
    expect(args[0]).toContain('SUCCESS:');
    expect(args[1]).toBe('Success message');
  });

  it('should not log when level is higher than INFO', () => {
    Logger.currentLevel = Logger.levels.WARN;

    Logger.success('Success message');

    expect(console.log).not.toHaveBeenCalled();
  });
});

// ============================================
// Logger.setLevel Tests
// ============================================

describe('Logger.setLevel', () => {
  beforeEach(() => {
    Logger.currentLevel = 0;
  });

  it('should set level to DEBUG', () => {
    Logger.setLevel('DEBUG');

    expect(Logger.currentLevel).toBe(0);
  });

  it('should set level to INFO', () => {
    Logger.setLevel('INFO');

    expect(Logger.currentLevel).toBe(1);
  });

  it('should set level to WARN', () => {
    Logger.setLevel('WARN');

    expect(Logger.currentLevel).toBe(2);
  });

  it('should set level to ERROR', () => {
    Logger.setLevel('ERROR');

    expect(Logger.currentLevel).toBe(3);
  });

  it('should default to 0 for unknown level', () => {
    Logger.setLevel('UNKNOWN' as 'DEBUG');

    expect(Logger.currentLevel).toBe(0);
  });
});

// ============================================
// Logger.levels Tests
// ============================================

describe('Logger.levels', () => {
  it('should have correct level values', () => {
    expect(Logger.levels.DEBUG).toBe(0);
    expect(Logger.levels.INFO).toBe(1);
    expect(Logger.levels.WARN).toBe(2);
    expect(Logger.levels.ERROR).toBe(3);
  });
});
