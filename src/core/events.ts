/**
 * Event Bus Module
 * Provides pub/sub event system for decoupled module communication
 */

import type { EventCallback, EventHistoryEntry } from '../types';
import { Logger } from '../utils/logger';

type ListenerMap = Map<string, Set<EventCallback>>;

const listeners: ListenerMap = new Map();
const onceListeners: ListenerMap = new Map();
const eventHistory: EventHistoryEntry[] = [];

const MAX_HISTORY = 100;
let debugMode = false;

/**
 * Subscribe to an event
 */
function on<T = unknown>(event: string, callback: EventCallback<T>): () => void {
  if (typeof callback !== 'function') {
    Logger.error('EventBus: callback must be a function');
    return () => {};
  }

  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event)!.add(callback as EventCallback);

  if (debugMode) {
    Logger.debug(`EventBus: Subscribed to '${event}'`);
  }

  // Return unsubscribe function
  return () => off(event, callback as EventCallback);
}

/**
 * Subscribe to an event (one-time only)
 */
function once<T = unknown>(event: string, callback: EventCallback<T>): () => void {
  if (typeof callback !== 'function') {
    Logger.error('EventBus: callback must be a function');
    return () => {};
  }

  if (!onceListeners.has(event)) {
    onceListeners.set(event, new Set());
  }
  onceListeners.get(event)!.add(callback as EventCallback);

  return () => {
    const set = onceListeners.get(event);
    if (set) set.delete(callback as EventCallback);
  };
}

/**
 * Unsubscribe from an event
 */
function off(event: string, callback: EventCallback): void {
  const set = listeners.get(event);
  if (set) {
    set.delete(callback);
    if (set.size === 0) {
      listeners.delete(event);
    }
  }

  const onceSet = onceListeners.get(event);
  if (onceSet) {
    onceSet.delete(callback);
    if (onceSet.size === 0) {
      onceListeners.delete(event);
    }
  }

  if (debugMode) {
    Logger.debug(`EventBus: Unsubscribed from '${event}'`);
  }
}

/**
 * Call wildcard listeners that match the event
 */
function callWildcardListeners(
  event: string,
  data: unknown,
  timestamp: number
): number {
  let count = 0;
  const [namespace] = event.split(':');

  // Check for namespace wildcards (e.g., 'light:*' matches 'light:changed')
  if (namespace && event.includes(':')) {
    const wildcardEvent = `${namespace}:*`;
    const wildcardListeners = listeners.get(wildcardEvent);
    if (wildcardListeners) {
      wildcardListeners.forEach((callback) => {
        try {
          callback(data, { event, timestamp, wildcard: wildcardEvent });
          count++;
        } catch (error) {
          Logger.error(
            `EventBus: Error in wildcard handler for '${wildcardEvent}':`,
            error
          );
        }
      });
    }
  }

  // Check for global wildcard ('*' matches everything)
  const globalListeners = listeners.get('*');
  if (globalListeners) {
    globalListeners.forEach((callback) => {
      try {
        callback(data, { event, timestamp, wildcard: '*' });
        count++;
      } catch (error) {
        Logger.error('EventBus: Error in global wildcard handler:', error);
      }
    });
  }

  return count;
}

/**
 * Emit an event
 */
function emit<T = unknown>(event: string, data: T = {} as T): number {
  const timestamp = Date.now();
  let handlerCount = 0;

  // Add to history
  eventHistory.push({ event, data, timestamp });
  if (eventHistory.length > MAX_HISTORY) {
    eventHistory.shift();
  }

  if (debugMode) {
    Logger.debug(`EventBus: Emit '${event}'`, data);
  }

  // Call exact match listeners
  const exactListeners = listeners.get(event);
  if (exactListeners) {
    exactListeners.forEach((callback) => {
      try {
        callback(data, { event, timestamp });
        handlerCount++;
      } catch (error) {
        Logger.error(`EventBus: Error in handler for '${event}':`, error);
      }
    });
  }

  // Call once listeners (and remove them)
  const onceSet = onceListeners.get(event);
  if (onceSet) {
    onceSet.forEach((callback) => {
      try {
        callback(data, { event, timestamp });
        handlerCount++;
      } catch (error) {
        Logger.error(`EventBus: Error in once handler for '${event}':`, error);
      }
    });
    onceListeners.delete(event);
  }

  // Call wildcard listeners
  handlerCount += callWildcardListeners(event, data, timestamp);

  return handlerCount;
}

/**
 * Remove all listeners for an event (or all events)
 */
function clear(event?: string): void {
  if (event) {
    listeners.delete(event);
    onceListeners.delete(event);
    Logger.info(`EventBus: Cleared listeners for '${event}'`);
  } else {
    listeners.clear();
    onceListeners.clear();
    Logger.info('EventBus: Cleared all listeners');
  }
}

/**
 * Get list of all registered events
 */
function getEvents(): string[] {
  const events = new Set([...listeners.keys(), ...onceListeners.keys()]);
  return Array.from(events);
}

/**
 * Get number of listeners for an event
 */
function listenerCount(event: string): number {
  const regular = listeners.get(event)?.size ?? 0;
  const onceCount = onceListeners.get(event)?.size ?? 0;
  return regular + onceCount;
}

/**
 * Get recent event history
 */
function getHistory(limit = 10, filter?: string): EventHistoryEntry[] {
  let history = [...eventHistory];
  if (filter) {
    history = history.filter((e) => e.event.startsWith(filter));
  }
  return history.slice(-limit);
}

/**
 * Enable/disable debug logging
 */
function setDebug(enabled: boolean): void {
  debugMode = enabled;
  Logger.info(`EventBus: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Wait for an event (Promise-based)
 */
function waitFor<T = unknown>(event: string, timeout = 0): Promise<T> {
  return new Promise((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const unsubscribe = once<T>(event, (data) => {
      if (timeoutId) clearTimeout(timeoutId);
      resolve(data);
    });

    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        unsubscribe();
        reject(new Error(`EventBus: Timeout waiting for '${event}'`));
      }, timeout);
    }
  });
}

/**
 * Emit an event and wait for a response event
 */
async function request<TRequest = unknown, TResponse = unknown>(
  requestEvent: string,
  data: TRequest,
  responseEvent: string,
  timeout = 5000
): Promise<TResponse> {
  const responsePromise = waitFor<TResponse>(responseEvent, timeout);
  emit(requestEvent, data);
  return responsePromise;
}

export const AppEvents = {
  on,
  once,
  off,
  emit,
  clear,
  getEvents,
  listenerCount,
  getHistory,
  setDebug,
  waitFor,
  request,
} as const;

// Register with the service registry
import { Registry } from './registry';

Registry.register({
  key: 'AppEvents',
  instance: AppEvents,
});
