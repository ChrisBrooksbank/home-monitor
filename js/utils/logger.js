// Centralized Logging Utility
const Logger = {
    // Log levels
    levels: {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
    },

    // Current log level (can be changed in production)
    currentLevel: 0, // DEBUG by default

    // Format timestamp
    _timestamp() {
        return new Date().toISOString().substring(11, 23);
    },

    // Format message with prefix
    _format(level, emoji, message, ...args) {
        const timestamp = this._timestamp();
        return [`[${timestamp}] ${emoji} ${level}:`, message, ...args];
    },

    // Debug logs (only in development)
    debug(message, ...args) {
        if (this.currentLevel <= this.levels.DEBUG && APP_CONFIG?.debug) {
            console.log(...this._format('DEBUG', '🔍', message, ...args));
        }
    },

    // Info logs
    info(message, ...args) {
        if (this.currentLevel <= this.levels.INFO) {
            console.log(...this._format('INFO', 'ℹ️', message, ...args));
        }
    },

    // Warning logs
    warn(message, ...args) {
        if (this.currentLevel <= this.levels.WARN) {
            console.warn(...this._format('WARN', '⚠️', message, ...args));
        }
    },

    // Error logs
    error(message, ...args) {
        if (this.currentLevel <= this.levels.ERROR) {
            console.error(...this._format('ERROR', '❌', message, ...args));
        }
    },

    // Success logs
    success(message, ...args) {
        if (this.currentLevel <= this.levels.INFO) {
            console.log(...this._format('SUCCESS', '✅', message, ...args));
        }
    },

    // Set log level for production
    setLevel(level) {
        this.currentLevel = this.levels[level] || 0;
    }
};

// Expose on window for global access
if (typeof window !== 'undefined') {
    window.Logger = Logger;
}
