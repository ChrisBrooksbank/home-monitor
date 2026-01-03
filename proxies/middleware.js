/**
 * Common middleware and utilities for proxy servers
 * DRY helper functions to reduce code duplication
 */

/**
 * Parse JSON request body
 * @param {http.IncomingMessage} req - HTTP request object
 * @returns {Promise<any>} Parsed JSON body
 */
export function parseJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const data = body ? JSON.parse(body) : {};
                resolve(data);
            } catch (error) {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

/**
 * Send JSON response
 * @param {http.ServerResponse} res - HTTP response object
 * @param {number} statusCode - HTTP status code
 * @param {object} data - Data to send as JSON
 * @param {string} origin - CORS origin
 */
export function sendJson(res, statusCode, data, origin) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin
    });
    res.end(JSON.stringify(data));
}

/**
 * Send error response
 * @param {http.ServerResponse} res - HTTP response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {string} origin - CORS origin
 */
export function sendError(res, statusCode, message, origin) {
    sendJson(res, statusCode, { error: message }, origin);
}

/**
 * CORS headers middleware
 * @param {http.ServerResponse} res - HTTP response object
 * @param {string} origin - Allowed origin
 * @param {string[]} methods - Allowed methods
 * @param {string[]} headers - Allowed headers
 */
export function setCorsHeaders(res, origin, methods = ['GET', 'POST', 'OPTIONS'], headers = ['Content-Type']) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', headers.join(', '));
}

/**
 * Handle preflight OPTIONS request
 * @param {http.IncomingMessage} req - HTTP request object
 * @param {http.ServerResponse} res - HTTP response object
 * @returns {boolean} True if was preflight request
 */
export function handlePreflight(req, res) {
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return true;
    }
    return false;
}

/**
 * Health check endpoint handler
 * @param {string} serviceName - Name of the service
 * @returns {object} Health check data
 */
export function getHealthStatus(serviceName) {
    return {
        status: 'ok',
        service: serviceName,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    };
}

/**
 * Log request to console
 * @param {http.IncomingMessage} req - HTTP request object
 */
export function logRequest(req) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
}

// Export for ES6 modules
export default {
    parseJsonBody,
    sendJson,
    sendError,
    setCorsHeaders,
    handlePreflight,
    getHealthStatus,
    logRequest
};
