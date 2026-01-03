/**
 * Application-wide constants
 * Extracted from main.js to improve maintainability
 */

// Time constants
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

// History retention periods
export const MOTION_HISTORY_RETENTION = 48 * MS_PER_HOUR; // 48 hours
export const TEMP_HISTORY_RETENTION = 24 * MS_PER_HOUR;   // 24 hours

// Polling intervals (in milliseconds)
export const POLLING_INTERVALS = {
    MOTION_SENSORS: 3 * MS_PER_SECOND,      // 3 seconds
    LIGHTS: 10 * MS_PER_SECOND,             // 10 seconds
    TEMPERATURE: 60 * MS_PER_SECOND,        // 60 seconds
    WEATHER: 15 * MS_PER_MINUTE,            // 15 minutes
    SUN_TIMES: 6 * MS_PER_HOUR,             // 6 hours
    SKY_UPDATE: 5 * MS_PER_MINUTE           // 5 minutes
};

// Timeouts
export const TIMEOUTS = {
    PROXY_CHECK: 2 * MS_PER_SECOND,         // 2 seconds
    API_REQUEST: 5 * MS_PER_SECOND          // 5 seconds
};

// Retry configuration
export const RETRY_CONFIG = {
    MAX_ATTEMPTS: 3,
    INITIAL_DELAY: 1 * MS_PER_SECOND,       // 1 second
    BACKOFF_MULTIPLIER: 2,
    MAX_DELAY: 10 * MS_PER_SECOND           // 10 seconds
};

// Chelmsford coordinates (for weather/sun times)
export const LOCATION = {
    LAT: 51.7356,
    LNG: 0.4685,
    NAME: 'Chelmsford, Essex, UK'
};

// Sonos settings
export const SONOS = {
    PORT: 1400,
    VOLUME_STEP: 5
};

// Temperature range for graph
export const TEMPERATURE = {
    MIN_DISPLAY: 0,
    MAX_DISPLAY: 30,
    BUFFER: 2  // Added to min/max for graph bounds
};

// Graph dimensions
export const GRAPH = {
    WIDTH: 1100,
    HEIGHT: 300,
    MARGIN_LEFT: 50,
    MARGIN_BOTTOM: 50
};

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MS_PER_SECOND,
        MS_PER_MINUTE,
        MS_PER_HOUR,
        MS_PER_DAY,
        MOTION_HISTORY_RETENTION,
        TEMP_HISTORY_RETENTION,
        POLLING_INTERVALS,
        TIMEOUTS,
        RETRY_CONFIG,
        LOCATION,
        SONOS,
        TEMPERATURE,
        GRAPH
    };
}
