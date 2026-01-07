// Configuration Module Entry Point
// Exports unified configuration interface

(function() {
    'use strict';

    /**
     * Initialize configuration system
     * Call this early in app startup
     */
    async function initConfig() {
        if (!window.ConfigLoader) {
            console.error('[Config] ConfigLoader not loaded. Ensure schema.js and loader.js are included.');
            return null;
        }

        const config = await window.ConfigLoader.load();

        if (!config.isValid) {
            console.error('[Config] Configuration has errors. Some features may not work.');
        }

        return config;
    }

    /**
     * Get current config (synchronous, after init)
     */
    function getConfig() {
        return window.CONFIG || null;
    }

    /**
     * Check if config is ready
     */
    function isReady() {
        return !!window.CONFIG;
    }

    // Export to window
    window.AppConfig = {
        init: initConfig,
        get: getConfig,
        isReady
    };
})();
