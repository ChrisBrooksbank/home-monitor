/**
 * Utility Helper Functions
 * Shared utilities for the Home Monitor application
 */

import type { AppConfig } from '../types';
import { Logger } from './logger';

declare const APP_CONFIG: AppConfig;

/**
 * Sanitize HTML to prevent XSS attacks
 */
export function sanitizeHTML(html: string): string {
  const temp = document.createElement('div');
  temp.textContent = html;
  return temp.innerHTML;
}

/**
 * Safely set innerHTML with sanitization
 */
export function safeSetHTML(element: HTMLElement, html: string): void {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // Remove any script tags
  const scripts = temp.querySelectorAll('script');
  scripts.forEach((script) => script.remove());

  // Set the sanitized HTML
  element.innerHTML = temp.innerHTML;
}

/**
 * Check if a proxy server is available
 */
export async function checkProxyAvailability(
  url: string,
  name: string
): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(APP_CONFIG.timeouts.proxyCheck),
    });
    if (response.ok) {
      Logger.success(`${name} proxy is available`);
      return true;
    }
    Logger.warn(`${name} proxy not available - controls will be disabled`);
    return false;
  } catch {
    Logger.warn(`${name} proxy not available - controls will be disabled`);
    return false;
  }
}

/**
 * Retry an async function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = APP_CONFIG.retry.maxAttempts,
  delay: number = APP_CONFIG.retry.initialDelay
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === maxAttempts) {
        Logger.error(`Failed after ${maxAttempts} attempts:`, lastError.message);
        throw lastError;
      }

      const backoffDelay = Math.min(
        delay * Math.pow(APP_CONFIG.retry.backoffMultiplier, attempt - 1),
        APP_CONFIG.retry.maxDelay
      );

      Logger.warn(`Attempt ${attempt} failed, retrying in ${backoffDelay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
    }
  }

  throw lastError;
}

/**
 * Debounce function to limit execution rate
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>): void {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle function to limit execution frequency
 */
export function throttle<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function (this: ThisParameterType<T>, ...args: Parameters<T>): void {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Interval manager to track and cleanup intervals
 */
class IntervalManagerClass {
  private intervals: ReturnType<typeof setInterval>[] = [];

  /**
   * Register a new interval
   */
  register(fn: () => void, delay: number): ReturnType<typeof setInterval> {
    const id = setInterval(fn, delay);
    this.intervals.push(id);
    Logger.debug(`Registered interval ${String(id)} with ${delay}ms delay`);
    return id;
  }

  /**
   * Clear a specific interval
   */
  clear(id: ReturnType<typeof setInterval>): void {
    clearInterval(id);
    this.intervals = this.intervals.filter((i) => i !== id);
    Logger.debug(`Cleared interval ${String(id)}`);
  }

  /**
   * Clear all registered intervals
   */
  clearAll(): void {
    Logger.info(`Clearing ${this.intervals.length} intervals`);
    this.intervals.forEach((id) => clearInterval(id));
    this.intervals = [];
  }
}

export const IntervalManager = new IntervalManagerClass();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    Logger.info('Page unloading - cleaning up resources');
    IntervalManager.clearAll();
  });

  // Expose on window for global access
  window.IntervalManager = IntervalManager;
}
