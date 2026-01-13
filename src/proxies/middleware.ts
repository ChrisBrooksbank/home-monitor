/**
 * Common middleware and utilities for proxy servers
 * DRY helper functions to reduce code duplication
 */

import type { IncomingMessage, ServerResponse } from 'http';

/**
 * Health check response data
 */
export interface HealthStatus {
    status: 'ok' | 'error';
    service: string;
    uptime: number;
    timestamp: string;
}

/**
 * Parse JSON request body
 * @param req - HTTP request object
 * @returns Parsed JSON body
 */
export function parseJsonBody<T = unknown>(req: IncomingMessage): Promise<T> {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk: Buffer) => (body += chunk.toString()));
        req.on('end', () => {
            try {
                const data = body ? (JSON.parse(body) as T) : ({} as T);
                resolve(data);
            } catch {
                reject(new Error('Invalid JSON'));
            }
        });
        req.on('error', reject);
    });
}

/**
 * Send JSON response
 * @param res - HTTP response object
 * @param statusCode - HTTP status code
 * @param data - Data to send as JSON
 * @param origin - CORS origin
 */
export function sendJson(
    res: ServerResponse,
    statusCode: number,
    data: unknown,
    origin: string
): void {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
    });
    res.end(JSON.stringify(data));
}

/**
 * Send error response
 * @param res - HTTP response object
 * @param statusCode - HTTP status code
 * @param message - Error message
 * @param origin - CORS origin
 */
export function sendError(
    res: ServerResponse,
    statusCode: number,
    message: string,
    origin: string
): void {
    sendJson(res, statusCode, { error: message }, origin);
}

/**
 * CORS headers middleware
 * @param res - HTTP response object
 * @param origin - Allowed origin
 * @param methods - Allowed methods
 * @param headers - Allowed headers
 */
export function setCorsHeaders(
    res: ServerResponse,
    origin: string,
    methods: string[] = ['GET', 'POST', 'OPTIONS'],
    headers: string[] = ['Content-Type']
): void {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', headers.join(', '));
}

/**
 * Handle preflight OPTIONS request
 * @param req - HTTP request object
 * @param res - HTTP response object
 * @returns True if was preflight request
 */
export function handlePreflight(req: IncomingMessage, res: ServerResponse): boolean {
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return true;
    }
    return false;
}

/**
 * Health check endpoint handler
 * @param serviceName - Name of the service
 * @returns Health check data
 */
export function getHealthStatus(serviceName: string): HealthStatus {
    return {
        status: 'ok',
        service: serviceName,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    };
}

/**
 * Log request to console
 * @param req - HTTP request object
 */
export function logRequest(req: IncomingMessage): void {
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
    logRequest,
};
