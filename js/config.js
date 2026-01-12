// Centralized Configuration
const APP_CONFIG = {
    // Proxy Server URLs
    proxies: {
        sonos: 'http://localhost:3000',
        tapo: 'http://localhost:3001',
        shield: 'http://localhost:8082',
        news: 'http://localhost:3002'
    },

    // Update Intervals (in milliseconds)
    intervals: {
        motionSensors: 3000,
        lights: 10000,
        sensorDetails: 10000,
        temperatures: 60000,
        motionLog: 60000,
        sky: 60000,
        sunTimes: 24 * 60 * 60 * 1000,
        weather: 15 * 60 * 1000,
        nest: 15 * 60 * 1000,
        sonosVolume: 30000,
        tapoStatus: 30000,
        tapoDiscovery: 5 * 60 * 1000,  // Re-scan for plugs every 5 minutes
        connectionStatus: 30000  // Hue bridge + proxy servers
    },

    // API Timeouts (in milliseconds)
    timeouts: {
        proxyCheck: 2000,
        apiRequest: 10000
    },

    // Retry Configuration
    retry: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2
    },

    // Debug Mode
    debug: false
};

// Expose on window for global access
if (typeof window !== 'undefined') {
    window.APP_CONFIG = APP_CONFIG;
}
