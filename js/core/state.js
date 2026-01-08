/**
 * Centralized State Store
 * Single source of truth for all application state
 *
 * Features:
 * - Centralized state management
 * - Event emission on state changes (integrates with AppEvents)
 * - Optional localStorage persistence
 * - Selectors for computed/derived state
 * - State history for debugging
 *
 * Usage:
 *   // Get state
 *   const lights = AppState.get('lights');
 *   const allState = AppState.getAll();
 *
 *   // Update state (emits 'state:lights:changed' event)
 *   AppState.set('lights', { ... });
 *
 *   // Update nested state
 *   AppState.setIn('lights.living-room', { on: true });
 *
 *   // Subscribe to state changes
 *   AppEvents.on('state:lights:changed', (data) => { ... });
 *
 *   // Use selectors for derived state
 *   const onLights = AppState.select('lightsOn'); // lights that are on
 */

(function() {
    'use strict';

    // =============================================================================
    // CONFIGURATION
    // =============================================================================

    const CONFIG = {
        persistKeys: ['tempHistory', 'motionHistory', 'positions'],
        maxHistorySize: 50,
        storagePrefix: 'appState_',
        enableHistory: true
    };

    // =============================================================================
    // STATE
    // =============================================================================

    /** @type {Object} The central state object */
    const state = {
        // Light state by room
        lights: {
            'Main Bedroom': [],
            'Guest Bedroom': [],
            'Landing': [],
            'Home Office': [],
            'Bathroom': [],
            'Lounge': [],
            'Hall': [],
            'Extension': [],
            'Kitchen': [],
            'Outdoor': []
        },

        // Previous light states for change detection
        previousLightStates: {},

        // Motion sensor state by room
        motion: {
            'Outdoor': { detected: false, lastUpdated: null },
            'Hall': { detected: false, lastUpdated: null },
            'Landing': { detected: false, lastUpdated: null },
            'Bathroom': { detected: false, lastUpdated: null }
        },

        // Temperature readings by room
        temperatures: {},

        // Temperature history (persisted)
        tempHistory: {},

        // Motion event history (persisted)
        motionHistory: [],

        // Tapo smart plug states
        plugs: {},

        // Sonos speaker states
        speakers: {},
        speakerVolumes: {},

        // Nest thermostat state
        nest: {
            devices: [],
            currentTemp: null,
            targetTemp: null,
            mode: null
        },

        // Connection status
        connections: {
            hue: { online: false, name: null },
            sonos: { online: false },
            tapo: { online: false },
            shield: { online: false }
        },

        // UI positions (persisted)
        positions: {},

        // Effect state
        effect: {
            inProgress: false,
            currentEffect: null,
            originalStates: {}
        },

        // App state
        app: {
            ready: false,
            viewMode: 'full',
            lastUpdate: null
        }
    };

    /** @type {Array} State change history for debugging */
    const stateHistory = [];

    // =============================================================================
    // CORE FUNCTIONS
    // =============================================================================

    /**
     * Get a state value by key
     * @param {string} key - State key (supports dot notation: 'lights.Hall')
     * @returns {any} State value
     */
    function get(key) {
        if (!key) return undefined;

        const keys = key.split('.');
        let value = state;

        for (const k of keys) {
            if (value === undefined || value === null) return undefined;
            value = value[k];
        }

        // Return a copy for objects/arrays to prevent mutation
        if (value && typeof value === 'object') {
            return Array.isArray(value) ? [...value] : { ...value };
        }
        return value;
    }

    /**
     * Get all state
     * @returns {Object} Copy of entire state
     */
    function getAll() {
        return JSON.parse(JSON.stringify(state));
    }

    /**
     * Set a state value
     * @param {string} key - State key
     * @param {any} value - New value
     * @param {Object} [options] - Options
     * @param {boolean} [options.silent=false] - Don't emit event
     * @param {boolean} [options.persist=auto] - Persist to localStorage
     */
    function set(key, value, options = {}) {
        const oldValue = get(key);
        const keys = key.split('.');
        let target = state;

        // Navigate to parent
        for (let i = 0; i < keys.length - 1; i++) {
            if (target[keys[i]] === undefined) {
                target[keys[i]] = {};
            }
            target = target[keys[i]];
        }

        // Set the value
        const finalKey = keys[keys.length - 1];
        target[finalKey] = value;

        // Record history
        if (CONFIG.enableHistory) {
            recordHistory(key, oldValue, value);
        }

        // Persist if needed
        const shouldPersist = options.persist ?? CONFIG.persistKeys.includes(keys[0]);
        if (shouldPersist) {
            persist(keys[0]);
        }

        // Emit event
        if (!options.silent && window.AppEvents) {
            AppEvents.emit(`state:${key}:changed`, {
                key,
                value,
                oldValue,
                timestamp: Date.now()
            });

            // Also emit top-level key event for convenience
            if (keys.length > 1) {
                AppEvents.emit(`state:${keys[0]}:changed`, {
                    key: keys[0],
                    value: state[keys[0]],
                    subKey: key,
                    timestamp: Date.now()
                });
            }
        }
    }

    /**
     * Update state by merging with existing value
     * @param {string} key - State key
     * @param {Object} updates - Object to merge
     * @param {Object} [options] - Options
     */
    function update(key, updates, options = {}) {
        const current = get(key) || {};
        if (typeof current !== 'object' || Array.isArray(current)) {
            set(key, updates, options);
            return;
        }
        set(key, { ...current, ...updates }, options);
    }

    /**
     * Push a value to an array state
     * @param {string} key - State key (must be an array)
     * @param {any} value - Value to push
     * @param {Object} [options] - Options
     * @param {number} [options.maxLength] - Max array length (removes oldest)
     */
    function push(key, value, options = {}) {
        const current = get(key);
        if (!Array.isArray(current)) {
            set(key, [value], options);
            return;
        }

        const newArray = [...current, value];
        if (options.maxLength && newArray.length > options.maxLength) {
            newArray.shift();
        }
        set(key, newArray, options);
    }

    /**
     * Remove a value from state
     * @param {string} key - State key
     */
    function remove(key) {
        const keys = key.split('.');
        let target = state;

        for (let i = 0; i < keys.length - 1; i++) {
            if (target[keys[i]] === undefined) return;
            target = target[keys[i]];
        }

        const finalKey = keys[keys.length - 1];
        const oldValue = target[finalKey];
        delete target[finalKey];

        if (window.AppEvents) {
            AppEvents.emit(`state:${key}:removed`, {
                key,
                oldValue,
                timestamp: Date.now()
            });
        }
    }

    // =============================================================================
    // PERSISTENCE
    // =============================================================================

    /**
     * Persist a state key to localStorage
     * @param {string} key - Top-level state key
     */
    function persist(key) {
        try {
            const value = state[key];
            if (value !== undefined) {
                localStorage.setItem(
                    CONFIG.storagePrefix + key,
                    JSON.stringify(value)
                );
            }
        } catch (error) {
            Logger.error(`Failed to persist state key '${key}':`, error);
        }
    }

    /**
     * Load persisted state from localStorage
     */
    function loadPersisted() {
        for (const key of CONFIG.persistKeys) {
            try {
                const stored = localStorage.getItem(CONFIG.storagePrefix + key);
                if (stored) {
                    state[key] = JSON.parse(stored);
                    Logger.debug(`Loaded persisted state: ${key}`);
                }
            } catch (error) {
                Logger.error(`Failed to load persisted state '${key}':`, error);
            }
        }

        // Also load legacy keys for backwards compatibility
        loadLegacyState();
    }

    /**
     * Load state from legacy localStorage keys (migration support)
     */
    function loadLegacyState() {
        const legacyMappings = {
            'tempHistory': 'tempHistory',
            'motionHistory': 'motionHistory'
        };

        for (const [legacyKey, stateKey] of Object.entries(legacyMappings)) {
            try {
                const stored = localStorage.getItem(legacyKey);
                if (stored && !state[stateKey]) {
                    state[stateKey] = JSON.parse(stored);
                    Logger.debug(`Migrated legacy state: ${legacyKey} -> ${stateKey}`);
                }
            } catch (error) {
                // Ignore legacy load errors
            }
        }
    }

    /**
     * Clear all persisted state
     */
    function clearPersisted() {
        for (const key of CONFIG.persistKeys) {
            localStorage.removeItem(CONFIG.storagePrefix + key);
        }
        Logger.info('Cleared all persisted state');
    }

    // =============================================================================
    // HISTORY & DEBUGGING
    // =============================================================================

    /**
     * Record a state change in history
     * @private
     */
    function recordHistory(key, oldValue, newValue) {
        stateHistory.push({
            key,
            oldValue,
            newValue,
            timestamp: Date.now()
        });

        if (stateHistory.length > CONFIG.maxHistorySize) {
            stateHistory.shift();
        }
    }

    /**
     * Get state change history
     * @param {number} [limit=10] - Number of entries
     * @param {string} [filter] - Filter by key prefix
     * @returns {Array} History entries
     */
    function getHistory(limit = 10, filter) {
        let history = [...stateHistory];
        if (filter) {
            history = history.filter(h => h.key.startsWith(filter));
        }
        return history.slice(-limit);
    }

    // =============================================================================
    // SELECTORS (computed/derived state)
    // =============================================================================

    const selectors = {
        /**
         * Get all lights that are currently on
         */
        lightsOn: () => {
            const result = [];
            for (const [room, lights] of Object.entries(state.lights)) {
                for (const light of lights) {
                    if (light.on) {
                        result.push({ ...light, room });
                    }
                }
            }
            return result;
        },

        /**
         * Get all rooms with active motion
         */
        activeMotion: () => {
            const result = [];
            for (const [room, motion] of Object.entries(state.motion)) {
                if (motion.detected) {
                    result.push({ room, ...motion });
                }
            }
            return result;
        },

        /**
         * Get all online connections
         */
        onlineConnections: () => {
            const result = [];
            for (const [name, status] of Object.entries(state.connections)) {
                if (status.online) {
                    result.push(name);
                }
            }
            return result;
        },

        /**
         * Get all plugs that are on
         */
        plugsOn: () => {
            const result = [];
            for (const [name, isOn] of Object.entries(state.plugs)) {
                if (isOn) {
                    result.push(name);
                }
            }
            return result;
        },

        /**
         * Get current average indoor temperature
         */
        avgIndoorTemp: () => {
            const indoorRooms = ['Main Bedroom', 'Guest Bedroom', 'Landing',
                'Home Office', 'Bathroom', 'Lounge', 'Hall', 'Extension', 'Kitchen'];
            const temps = [];
            for (const [room, temp] of Object.entries(state.temperatures)) {
                if (indoorRooms.includes(room) && temp !== null) {
                    temps.push(temp);
                }
            }
            if (temps.length === 0) return null;
            return temps.reduce((a, b) => a + b, 0) / temps.length;
        },

        /**
         * Get recent motion events (last 24 hours)
         */
        recentMotion: () => {
            const cutoff = Date.now() - (24 * 60 * 60 * 1000);
            return state.motionHistory.filter(e => e.time > cutoff);
        }
    };

    /**
     * Run a selector
     * @param {string} name - Selector name
     * @returns {any} Selector result
     */
    function select(name) {
        const selector = selectors[name];
        if (!selector) {
            Logger.warn(`Unknown selector: ${name}`);
            return undefined;
        }
        return selector();
    }

    /**
     * Register a custom selector
     * @param {string} name - Selector name
     * @param {Function} fn - Selector function
     */
    function registerSelector(name, fn) {
        if (typeof fn !== 'function') {
            Logger.error('Selector must be a function');
            return;
        }
        selectors[name] = fn;
    }

    // =============================================================================
    // BATCH OPERATIONS
    // =============================================================================

    /**
     * Set multiple state values at once
     * @param {Object} updates - Key-value pairs to set
     * @param {Object} [options] - Options
     */
    function setMany(updates, options = {}) {
        const silent = options.silent;
        options.silent = true; // Suppress individual events

        for (const [key, value] of Object.entries(updates)) {
            set(key, value, options);
        }

        // Emit single batch event
        if (!silent && window.AppEvents) {
            AppEvents.emit('state:batch:changed', {
                keys: Object.keys(updates),
                timestamp: Date.now()
            });
        }
    }

    /**
     * Reset state to initial values
     * @param {string} [key] - Specific key to reset (or all if omitted)
     */
    function reset(key) {
        if (key) {
            // Reset specific key to empty/default
            const current = state[key];
            if (Array.isArray(current)) {
                set(key, []);
            } else if (typeof current === 'object' && current !== null) {
                set(key, {});
            } else {
                set(key, null);
            }
        } else {
            Logger.warn('Full state reset requested - this is destructive');
        }
    }

    // =============================================================================
    // INITIALIZATION
    // =============================================================================

    /**
     * Initialize the state store
     */
    function init() {
        loadPersisted();
        Logger.info('AppState initialized');

        // Subscribe to relevant events to auto-update state
        if (window.AppEvents) {
            // Update connection state from events
            AppEvents.on('connection:hue:online', (data) => {
                update('connections.hue', { online: true, name: data.name }, { silent: true });
            });
            AppEvents.on('connection:hue:offline', () => {
                update('connections.hue', { online: false }, { silent: true });
            });
            AppEvents.on('connection:proxy:online', (data) => {
                set(`connections.${data.proxy}.online`, true, { silent: true });
            });
            AppEvents.on('connection:proxy:offline', (data) => {
                set(`connections.${data.proxy}.online`, false, { silent: true });
            });

            // Update app ready state
            AppEvents.on('app:ready', () => {
                set('app.ready', true, { silent: true });
                set('app.lastUpdate', Date.now(), { silent: true });
            });
        }
    }

    // =============================================================================
    // EXPOSE MODULE
    // =============================================================================

    window.AppState = {
        // Core
        get,
        getAll,
        set,
        update,
        push,
        remove,

        // Persistence
        persist,
        loadPersisted,
        clearPersisted,

        // Selectors
        select,
        registerSelector,

        // Batch
        setMany,
        reset,

        // Debug
        getHistory,

        // Init
        init
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
