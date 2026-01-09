/**
 * Initializer Module
 * App bootstrap and feature registration
 * Orchestrates startup sequence and feature initialization
 */

(function() {
    'use strict';

    // =============================================================================
    // FEATURE REGISTRY
    // =============================================================================

    const features = new Map();
    const initOrder = [];

    /**
     * Register a feature for initialization
     * @param {string} name - Feature identifier
     * @param {Object} config - Feature configuration
     * @param {Function} config.init - Initialization function
     * @param {Function} [config.condition] - Condition to check before init
     * @param {string[]} [config.dependencies] - Features that must init first
     * @param {number} [config.priority=50] - Init priority (lower = earlier)
     */
    function registerFeature(name, config) {
        const feature = {
            name,
            init: config.init,
            condition: config.condition || (() => true),
            dependencies: config.dependencies || [],
            priority: config.priority || 50,
            initialized: false
        };
        features.set(name, feature);
        Logger.debug?.(`Initializer: Registered feature '${name}'`);
    }

    /**
     * Initialize a single feature
     * @param {string} name - Feature name
     * @returns {Promise<boolean>} True if initialized successfully
     */
    async function initFeature(name) {
        const feature = features.get(name);
        if (!feature) {
            Logger.warn(`Initializer: Feature '${name}' not registered`);
            return false;
        }

        if (feature.initialized) {
            return true;
        }

        // Check dependencies
        for (const dep of feature.dependencies) {
            if (!features.get(dep)?.initialized) {
                Logger.warn(`Initializer: Feature '${name}' waiting for dependency '${dep}'`);
                await initFeature(dep);
            }
        }

        // Check condition
        if (!feature.condition()) {
            Logger.info(`Initializer: Feature '${name}' skipped (condition not met)`);
            return false;
        }

        try {
            await feature.init();
            feature.initialized = true;
            initOrder.push(name);
            Logger.success?.(`Initializer: Feature '${name}' initialized`) ||
                Logger.info(`Initializer: Feature '${name}' initialized`);
            return true;
        } catch (error) {
            Logger.error(`Initializer: Feature '${name}' failed:`, error);
            return false;
        }
    }

    // =============================================================================
    // DRAGGABLE UI SETUP
    // =============================================================================

    /**
     * Load saved position for a draggable element
     * @param {Element} element - DOM element
     * @param {string} storageKey - localStorage key for position
     */
    function loadSavedPosition(element, storageKey) {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                const pos = JSON.parse(saved);
                if (element.tagName === 'g' || element.namespaceURI === 'http://www.w3.org/2000/svg') {
                    element.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
                } else {
                    element.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
                }
            } catch (e) {
                // Invalid saved position, ignore
            }
        }
    }

    /**
     * Setup draggable functionality for UI elements
     */
    function setupDraggables() {
        if (typeof createDraggable !== 'function') {
            Logger.warn('Initializer: createDraggable not available');
            return;
        }

        // Weather panel
        const weatherPanel = document.getElementById('weather-info-panel');
        if (weatherPanel) {
            loadSavedPosition(weatherPanel, 'weatherPanelPosition');
            createDraggable(weatherPanel, { storageKey: 'weatherPanelPosition' });
        }

        // Jukebox (light effects)
        const jukebox = document.getElementById('jukebox');
        if (jukebox) {
            loadSavedPosition(jukebox, 'jukeboxPosition');
            createDraggable(jukebox, {
                storageKey: 'jukeboxPosition',
                excludeSelector: '.jukebox-button'
            });
        }
    }

    /**
     * Setup lamppost click handler
     * @param {Function} toggleLight - Light toggle function
     * @param {Function} getRoomLights - Function to get room lights
     */
    function setupLamppostHandler(toggleLight, getRoomLights) {
        const lampHousing = document.getElementById('lamp-housing');
        if (lampHousing) {
            lampHousing.style.cursor = 'pointer';
            lampHousing.addEventListener('dblclick', () => {
                const outdoorLights = getRoomLights('Outdoor');
                if (outdoorLights && outdoorLights.length > 0) {
                    toggleLight(outdoorLights[0].id, outdoorLights[0].on);
                }
            });
        }
    }

    // =============================================================================
    // CONFIGURATION VALIDATION
    // =============================================================================

    /**
     * Initialize and validate app configuration
     * @returns {Promise<Object>} Configuration object with validation results
     */
    async function initConfiguration() {
        if (!window.AppConfig) {
            Logger.warn('Initializer: AppConfig not available');
            return { isValid: true, hasFeature: () => true };
        }

        const config = await window.AppConfig.init();
        if (!config.isValid) {
            Logger.error('Configuration has errors - some features may not work');
        }

        // Log feature availability
        const featureList = ['hue', 'weather', 'nest', 'sonos', 'tapo', 'shield'];
        const available = featureList.filter(f => config.hasFeature(f));
        const unavailable = featureList.filter(f => !config.hasFeature(f));

        if (available.length > 0) {
            Logger.info(`Available features: ${available.join(', ')}`);
        }
        if (unavailable.length > 0) {
            Logger.warn(`Unavailable features: ${unavailable.join(', ')}`);
        }

        return config;
    }

    // =============================================================================
    // DOM READY HELPER
    // =============================================================================

    /**
     * Execute callback when DOM is ready
     * @param {Function} fn - Callback function
     */
    function onReady(fn) {
        const run = () => {
            try {
                fn();
            } catch (e) {
                Logger.error('Init error:', e);
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run);
        } else {
            // DOM already ready, run immediately
            run();
        }
    }

    // =============================================================================
    // EXPOSE MODULE
    // =============================================================================

    window.AppInitializer = {
        // Feature registration
        registerFeature,
        initFeature,
        getInitializedFeatures: () => [...initOrder],

        // UI setup
        setupDraggables,
        setupLamppostHandler,
        loadSavedPosition,

        // Configuration
        initConfiguration,

        // DOM ready
        onReady
    };

    // Also expose loadSavedPosition globally for use by thermometer creation
    window.loadSavedPosition = loadSavedPosition;

})();
