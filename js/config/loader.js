// Configuration Loader with Validation
// Loads and validates all configuration sources

(function() {
    'use strict';

    const CONFIG_SOURCES = {
        HUE: 'config.js (HUE_CONFIG)',
        WEATHER: 'config.js (WEATHER_CONFIG)',
        NEST: 'nest-config.js (NEST_CONFIG)',
        DEVICES: 'config/devices.json',
        APP: 'js/config.js (APP_CONFIG)'
    };

    /**
     * Validation result object
     */
    class ValidationResult {
        constructor() {
            this.valid = true;
            this.errors = [];
            this.warnings = [];
        }

        addError(source, field, message) {
            this.valid = false;
            this.errors.push({ source, field, message });
        }

        addWarning(source, field, message) {
            this.warnings.push({ source, field, message });
        }

        log() {
            if (this.errors.length > 0) {
                console.group('%c Configuration Errors', 'color: #e74c3c; font-weight: bold');
                this.errors.forEach(e => {
                    console.error(`[${e.source}] ${e.field}: ${e.message}`);
                });
                console.groupEnd();
            }

            if (this.warnings.length > 0) {
                console.group('%c Configuration Warnings', 'color: #f39c12; font-weight: bold');
                this.warnings.forEach(w => {
                    console.warn(`[${w.source}] ${w.field}: ${w.message}`);
                });
                console.groupEnd();
            }

            if (this.valid && this.warnings.length === 0) {
                console.log('%c Configuration loaded successfully', 'color: #27ae60');
            }
        }
    }

    /**
     * Validate a config object against a schema
     */
    function validateConfig(config, schemaName, sourceName) {
        const result = new ValidationResult();
        const schema = window.ConfigSchema?.SCHEMAS?.[schemaName];

        if (!schema) {
            result.addError(sourceName, 'schema', `Unknown schema: ${schemaName}`);
            return result;
        }

        if (!config) {
            result.addError(sourceName, 'config', `Configuration not found. Create ${sourceName}`);
            return result;
        }

        // Check required fields
        for (const field of schema.required) {
            if (config[field] === undefined || config[field] === null || config[field] === '') {
                result.addError(sourceName, field, `Required field missing`);
            } else if (schema.validators?.[field] && !schema.validators[field](config[field])) {
                result.addError(sourceName, field, schema.errors?.[field] || 'Invalid value');
            }
        }

        // Check optional fields if present
        for (const field of schema.optional) {
            if (config[field] !== undefined && schema.validators?.[field]) {
                if (!schema.validators[field](config[field])) {
                    result.addWarning(sourceName, field, schema.errors?.[field] || 'Invalid value');
                }
            }
        }

        return result;
    }

    /**
     * Load devices.json asynchronously
     */
    async function loadDevices() {
        try {
            const response = await fetch('/config/devices.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.warn('[Config] Could not load devices.json:', error.message);
            return null;
        }
    }

    /**
     * Main config loader - validates all configs and returns unified object
     */
    async function loadConfig() {
        const result = new ValidationResult();

        // Validate HUE_CONFIG
        const hueResult = validateConfig(
            window.HUE_CONFIG,
            'hue',
            CONFIG_SOURCES.HUE
        );
        result.errors.push(...hueResult.errors);
        result.warnings.push(...hueResult.warnings);
        if (!hueResult.valid) result.valid = false;

        // Validate WEATHER_CONFIG (optional but recommended)
        if (window.WEATHER_CONFIG) {
            const weatherResult = validateConfig(
                window.WEATHER_CONFIG,
                'weather',
                CONFIG_SOURCES.WEATHER
            );
            result.warnings.push(...weatherResult.errors); // Weather is optional, demote to warnings
            result.warnings.push(...weatherResult.warnings);
        } else {
            result.addWarning(CONFIG_SOURCES.WEATHER, 'config', 'Weather config not found - weather features disabled');
        }

        // Validate NEST_CONFIG (optional)
        if (window.NEST_CONFIG) {
            const nestResult = validateConfig(
                window.NEST_CONFIG,
                'nest',
                CONFIG_SOURCES.NEST
            );
            result.warnings.push(...nestResult.errors); // Nest is optional
            result.warnings.push(...nestResult.warnings);
        }

        // Validate APP_CONFIG
        const appResult = validateConfig(
            window.APP_CONFIG,
            'app',
            CONFIG_SOURCES.APP
        );
        result.errors.push(...appResult.errors);
        result.warnings.push(...appResult.warnings);
        if (!appResult.valid) result.valid = false;

        // Load devices.json
        const devices = await loadDevices();
        if (devices) {
            const devicesResult = validateConfig(
                devices,
                'devices',
                CONFIG_SOURCES.DEVICES
            );
            result.warnings.push(...devicesResult.errors);
            result.warnings.push(...devicesResult.warnings);
        }

        // Log validation results
        result.log();

        // Build unified config object
        const CONFIG = {
            hue: window.HUE_CONFIG || {},
            weather: window.WEATHER_CONFIG || {},
            nest: window.NEST_CONFIG || {},
            devices: devices || {},
            app: window.APP_CONFIG || {},

            // Convenience accessors
            get bridgeUrl() {
                return this.hue.BRIDGE_IP ? `http://${this.hue.BRIDGE_IP}/api/${this.hue.USERNAME}` : null;
            },

            get isValid() {
                return result.valid;
            },

            get errors() {
                return result.errors;
            },

            get warnings() {
                return result.warnings;
            },

            // Check if a feature is configured
            hasFeature(name) {
                switch (name) {
                    case 'hue': return !!this.hue.BRIDGE_IP && !!this.hue.USERNAME;
                    case 'weather': return !!this.weather.API_KEY && !this.weather.API_KEY.includes('YOUR');
                    case 'nest': return !!this.nest.ACCESS_TOKEN;
                    case 'sonos': return Object.keys(this.devices.sonos || {}).length > 0;
                    case 'tapo': return Object.keys(this.devices.tapo || {}).length > 0;
                    case 'shield': return !!this.devices.shield?.ip;
                    default: return false;
                }
            }
        };

        // Store globally
        window.CONFIG = CONFIG;

        return CONFIG;
    }

    // Export to window
    window.ConfigLoader = {
        load: loadConfig,
        validate: validateConfig,
        ValidationResult
    };
})();
