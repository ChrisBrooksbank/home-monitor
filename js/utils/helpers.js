// Utility Helper Functions

/**
 * Sanitize HTML to prevent XSS attacks
 * @param {string} html - HTML string to sanitize
 * @returns {string} - Sanitized HTML
 */
function sanitizeHTML(html) {
    const temp = document.createElement('div');
    temp.textContent = html;
    return temp.innerHTML;
}

/**
 * Safely set innerHTML with sanitization
 * @param {HTMLElement} element - Target element
 * @param {string} html - HTML content to set
 */
function safeSetHTML(element, html) {
    // Create a temporary div to parse HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Remove any script tags
    const scripts = temp.querySelectorAll('script');
    scripts.forEach(script => script.remove());

    // Set the sanitized HTML
    element.innerHTML = temp.innerHTML;
}

/**
 * Check if a proxy server is available
 * @param {string} url - Proxy URL to check
 * @param {string} name - Proxy name for logging
 * @returns {Promise<boolean>} - True if available
 */
async function checkProxyAvailability(url, name) {
    try {
        const response = await fetch(url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(APP_CONFIG.timeouts.proxyCheck)
        });
        Logger.success(`${name} proxy is available`);
        return true;
    } catch (error) {
        Logger.warn(`${name} proxy not available - controls will be disabled`);
        return false;
    }
}

/**
 * Retry an async function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxAttempts - Maximum retry attempts
 * @param {number} delay - Initial delay in ms
 * @returns {Promise<any>} - Result of the function
 */
async function retryWithBackoff(fn, maxAttempts = APP_CONFIG.retry.maxAttempts, delay = APP_CONFIG.retry.initialDelay) {
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt === maxAttempts) {
                Logger.error(`Failed after ${maxAttempts} attempts:`, error.message);
                throw error;
            }

            const backoffDelay = Math.min(
                delay * Math.pow(APP_CONFIG.retry.backoffMultiplier, attempt - 1),
                APP_CONFIG.retry.maxDelay
            );

            Logger.warn(`Attempt ${attempt} failed, retrying in ${backoffDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
    }

    throw lastError;
}

/**
 * Debounce function to limit execution rate
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
function debounce(fn, delay) {
    let timeoutId;
    return function(...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Throttle function to limit execution frequency
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} - Throttled function
 */
function throttle(fn, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Interval manager to track and cleanup intervals
 */
const IntervalManager = {
    intervals: [],

    /**
     * Register a new interval
     * @param {Function} fn - Function to execute
     * @param {number} delay - Delay in milliseconds
     * @returns {number} - Interval ID
     */
    register(fn, delay) {
        const id = setInterval(fn, delay);
        this.intervals.push(id);
        Logger.debug(`Registered interval ${id} with ${delay}ms delay`);
        return id;
    },

    /**
     * Clear a specific interval
     * @param {number} id - Interval ID to clear
     */
    clear(id) {
        clearInterval(id);
        this.intervals = this.intervals.filter(i => i !== id);
        Logger.debug(`Cleared interval ${id}`);
    },

    /**
     * Clear all registered intervals
     */
    clearAll() {
        Logger.info(`Clearing ${this.intervals.length} intervals`);
        this.intervals.forEach(id => clearInterval(id));
        this.intervals = [];
    }
};

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    Logger.info('Page unloading - cleaning up resources');
    IntervalManager.clearAll();
});

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        sanitizeHTML,
        safeSetHTML,
        checkProxyAvailability,
        retryWithBackoff,
        debounce,
        throttle,
        IntervalManager
    };
}
