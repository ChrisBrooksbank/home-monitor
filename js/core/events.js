/**
 * Event Bus Module
 * Provides pub/sub event system for decoupled module communication
 *
 * Usage:
 *   // Subscribe to events
 *   AppEvents.on('motion:detected', (data) => console.log('Motion in', data.room));
 *
 *   // Subscribe once (auto-removes after first trigger)
 *   AppEvents.once('app:ready', () => console.log('App initialized'));
 *
 *   // Emit events
 *   AppEvents.emit('motion:detected', { room: 'Hall', sensorId: 5 });
 *
 *   // Unsubscribe
 *   const unsubscribe = AppEvents.on('light:changed', handler);
 *   unsubscribe(); // removes the listener
 *
 *   // Wildcard subscriptions
 *   AppEvents.on('light:*', (data) => console.log('Any light event:', data));
 *   AppEvents.on('*', (data) => console.log('All events:', data));
 */

(function() {
    'use strict';

    // =============================================================================
    // STATE
    // =============================================================================

    /** @type {Map<string, Set<Function>>} */
    const listeners = new Map();

    /** @type {Map<string, Set<Function>>} */
    const onceListeners = new Map();

    /** @type {Array<{event: string, data: any, timestamp: number}>} */
    const eventHistory = [];

    const MAX_HISTORY = 100;
    let debugMode = false;

    // =============================================================================
    // CORE FUNCTIONS
    // =============================================================================

    /**
     * Subscribe to an event
     * @param {string} event - Event name (supports wildcards: 'light:*' or '*')
     * @param {Function} callback - Handler function
     * @returns {Function} Unsubscribe function
     */
    function on(event, callback) {
        if (typeof callback !== 'function') {
            Logger.error('EventBus: callback must be a function');
            return () => {};
        }

        if (!listeners.has(event)) {
            listeners.set(event, new Set());
        }
        listeners.get(event).add(callback);

        if (debugMode) {
            Logger.debug(`EventBus: Subscribed to '${event}'`);
        }

        // Return unsubscribe function
        return () => off(event, callback);
    }

    /**
     * Subscribe to an event (one-time only)
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     * @returns {Function} Unsubscribe function
     */
    function once(event, callback) {
        if (typeof callback !== 'function') {
            Logger.error('EventBus: callback must be a function');
            return () => {};
        }

        if (!onceListeners.has(event)) {
            onceListeners.set(event, new Set());
        }
        onceListeners.get(event).add(callback);

        return () => {
            const set = onceListeners.get(event);
            if (set) set.delete(callback);
        };
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler to remove
     */
    function off(event, callback) {
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
     * Emit an event
     * @param {string} event - Event name
     * @param {any} [data] - Event data
     * @returns {number} Number of handlers called
     */
    function emit(event, data = {}) {
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
            exactListeners.forEach(callback => {
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
            onceSet.forEach(callback => {
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
     * Call wildcard listeners that match the event
     * @private
     */
    function callWildcardListeners(event, data, timestamp) {
        let count = 0;
        const [namespace] = event.split(':');

        // Check for namespace wildcards (e.g., 'light:*' matches 'light:changed')
        if (namespace && event.includes(':')) {
            const wildcardEvent = `${namespace}:*`;
            const wildcardListeners = listeners.get(wildcardEvent);
            if (wildcardListeners) {
                wildcardListeners.forEach(callback => {
                    try {
                        callback(data, { event, timestamp, wildcard: wildcardEvent });
                        count++;
                    } catch (error) {
                        Logger.error(`EventBus: Error in wildcard handler for '${wildcardEvent}':`, error);
                    }
                });
            }
        }

        // Check for global wildcard ('*' matches everything)
        const globalListeners = listeners.get('*');
        if (globalListeners) {
            globalListeners.forEach(callback => {
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

    // =============================================================================
    // UTILITY FUNCTIONS
    // =============================================================================

    /**
     * Remove all listeners for an event (or all events)
     * @param {string} [event] - Event name (omit to clear all)
     */
    function clear(event) {
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
     * @returns {string[]} Array of event names
     */
    function getEvents() {
        const events = new Set([...listeners.keys(), ...onceListeners.keys()]);
        return Array.from(events);
    }

    /**
     * Get number of listeners for an event
     * @param {string} event - Event name
     * @returns {number} Listener count
     */
    function listenerCount(event) {
        const regular = listeners.get(event)?.size || 0;
        const once = onceListeners.get(event)?.size || 0;
        return regular + once;
    }

    /**
     * Get recent event history
     * @param {number} [limit=10] - Number of events to return
     * @param {string} [filter] - Filter by event name prefix
     * @returns {Array} Recent events
     */
    function getHistory(limit = 10, filter) {
        let history = [...eventHistory];
        if (filter) {
            history = history.filter(e => e.event.startsWith(filter));
        }
        return history.slice(-limit);
    }

    /**
     * Enable/disable debug logging
     * @param {boolean} enabled
     */
    function setDebug(enabled) {
        debugMode = enabled;
        Logger.info(`EventBus: Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    // =============================================================================
    // CONVENIENCE METHODS
    // =============================================================================

    /**
     * Wait for an event (Promise-based)
     * @param {string} event - Event to wait for
     * @param {number} [timeout=0] - Timeout in ms (0 = no timeout)
     * @returns {Promise<any>} Resolves with event data
     */
    function waitFor(event, timeout = 0) {
        return new Promise((resolve, reject) => {
            let timeoutId;

            const unsubscribe = once(event, (data) => {
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
     * @param {string} requestEvent - Event to emit
     * @param {any} data - Request data
     * @param {string} responseEvent - Event to wait for
     * @param {number} [timeout=5000] - Timeout in ms
     * @returns {Promise<any>} Response data
     */
    async function request(requestEvent, data, responseEvent, timeout = 5000) {
        const responsePromise = waitFor(responseEvent, timeout);
        emit(requestEvent, data);
        return responsePromise;
    }

    // =============================================================================
    // STANDARD EVENTS (documentation)
    // =============================================================================

    /**
     * Standard event names used throughout the app:
     *
     * Connection Events:
     *   connection:hue:online     - Hue bridge came online
     *   connection:hue:offline    - Hue bridge went offline
     *   connection:proxy:online   - Proxy came online { proxy: 'sonos'|'tapo'|'shield' }
     *   connection:proxy:offline  - Proxy went offline { proxy: 'sonos'|'tapo'|'shield' }
     *
     * Motion Events:
     *   motion:detected           - Motion detected { room, sensorId, timestamp }
     *   motion:cleared            - Motion cleared { room, sensorId }
     *
     * Light Events:
     *   light:changed             - Light state changed { room, lightId, on, color }
     *   light:toggled             - Light manually toggled { lightId, newState }
     *
     * Temperature Events:
     *   temperature:updated       - Temperature reading { room, temp, sensorId }
     *   temperature:alert         - Temperature threshold crossed { room, temp, threshold }
     *
     * App Lifecycle:
     *   app:ready                 - App fully initialized
     *   app:error                 - App error occurred { error, context }
     *   poll:started              - Polling started
     *   poll:stopped              - Polling stopped
     */

    // =============================================================================
    // EXPOSE MODULE
    // =============================================================================

    window.AppEvents = {
        // Core
        on,
        once,
        off,
        emit,

        // Utilities
        clear,
        getEvents,
        listenerCount,
        getHistory,
        setDebug,

        // Async helpers
        waitFor,
        request
    };

})();
