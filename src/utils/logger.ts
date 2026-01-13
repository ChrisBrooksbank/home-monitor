/**
 * Centralized Logging Utility
 * Provides consistent logging with timestamps and log levels
 */

import type { LogLevel, LogLevels, AppConfig } from '../types';

declare const APP_CONFIG: AppConfig | undefined;

const levels: LogLevels = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

/**
 * Logger object with mutable state
 */
export const Logger = {
  levels,
  currentLevel: 0 as number,

  /**
   * Format timestamp for log output
   */
  _timestamp(): string {
    return new Date().toISOString().substring(11, 23);
  },

  /**
   * Format message with prefix
   */
  _format(level: string, emoji: string, message: string, ...args: unknown[]): unknown[] {
    const ts = this._timestamp();
    return [`[${ts}] ${emoji} ${level}:`, message, ...args];
  },

  /**
   * Debug logs (only in development/debug mode)
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.currentLevel <= this.levels.DEBUG && APP_CONFIG?.debug) {
      console.log(...this._format('DEBUG', '\u{1F50D}', message, ...args));
    }
  },

  /**
   * Info logs
   */
  info(message: string, ...args: unknown[]): void {
    if (this.currentLevel <= this.levels.INFO) {
      console.log(...this._format('INFO', '\u2139\uFE0F', message, ...args));
    }
  },

  /**
   * Warning logs
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.currentLevel <= this.levels.WARN) {
      console.warn(...this._format('WARN', '\u26A0\uFE0F', message, ...args));
    }
  },

  /**
   * Error logs
   */
  error(message: string, ...args: unknown[]): void {
    if (this.currentLevel <= this.levels.ERROR) {
      console.error(...this._format('ERROR', '\u274C', message, ...args));
    }
  },

  /**
   * Success logs (uses INFO level)
   */
  success(message: string, ...args: unknown[]): void {
    if (this.currentLevel <= this.levels.INFO) {
      console.log(...this._format('SUCCESS', '\u2705', message, ...args));
    }
  },

  /**
   * Set log level for production
   */
  setLevel(level: LogLevel): void {
    this.currentLevel = this.levels[level] ?? 0;
  },
};

export type LoggerType = typeof Logger;
