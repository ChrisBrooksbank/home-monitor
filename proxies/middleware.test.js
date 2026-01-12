/**
 * Unit tests for middleware.js
 * Tests common proxy server utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    parseJsonBody,
    sendJson,
    sendError,
    setCorsHeaders,
    handlePreflight,
    getHealthStatus,
    logRequest
} from './middleware.js';

// ============================================
// Mock Request/Response Helpers
// ============================================

function createMockRequest(options = {}) {
    const { method = 'GET', url = '/', body = '' } = options;
    const listeners = {};

    const req = {
        method,
        url,
        on: vi.fn((event, callback) => {
            listeners[event] = callback;
            return req;
        }),
        _emit: (event, data) => {
            if (listeners[event]) listeners[event](data);
        },
        _emitBody: () => {
            if (body) listeners.data?.(body);
            listeners.end?.();
        }
    };
    return req;
}

function createMockResponse() {
    const headers = {};
    let statusCode = 200;
    let body = '';

    return {
        writeHead: vi.fn((code, hdrs = {}) => {
            statusCode = code;
            Object.assign(headers, hdrs);
        }),
        setHeader: vi.fn((name, value) => {
            headers[name] = value;
        }),
        end: vi.fn((data = '') => {
            body = data;
        }),
        _getStatusCode: () => statusCode,
        _getHeaders: () => headers,
        _getBody: () => body,
        _getJson: () => JSON.parse(body)
    };
}

// ============================================
// parseJsonBody Tests
// ============================================

describe('parseJsonBody', () => {
    it('should parse valid JSON body', async () => {
        const req = createMockRequest({ body: '{"name":"test","value":42}' });

        const promise = parseJsonBody(req);
        req._emitBody();

        const result = await promise;
        expect(result).toEqual({ name: 'test', value: 42 });
    });

    it('should return empty object for empty body', async () => {
        const req = createMockRequest({ body: '' });

        const promise = parseJsonBody(req);
        req._emitBody();

        const result = await promise;
        expect(result).toEqual({});
    });

    it('should reject on invalid JSON', async () => {
        const req = createMockRequest({ body: 'not valid json' });

        const promise = parseJsonBody(req);
        req._emitBody();

        await expect(promise).rejects.toThrow('Invalid JSON');
    });

    it('should handle request errors', async () => {
        const req = createMockRequest();

        const promise = parseJsonBody(req);
        req._emit('error', new Error('Connection reset'));

        await expect(promise).rejects.toThrow('Connection reset');
    });

    it('should handle chunked data', async () => {
        const req = createMockRequest();
        const listeners = {};
        req.on = vi.fn((event, cb) => {
            listeners[event] = cb;
            return req;
        });

        const promise = parseJsonBody(req);

        // Simulate chunked data
        listeners.data('{"part');
        listeners.data('1":"a",');
        listeners.data('"part2":"b"}');
        listeners.end();

        const result = await promise;
        expect(result).toEqual({ part1: 'a', part2: 'b' });
    });
});

// ============================================
// sendJson Tests
// ============================================

describe('sendJson', () => {
    it('should send JSON response with correct headers', () => {
        const res = createMockResponse();
        const data = { message: 'success' };

        sendJson(res, 200, data, 'http://localhost:5173');

        expect(res.writeHead).toHaveBeenCalledWith(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'http://localhost:5173'
        });
        expect(res.end).toHaveBeenCalledWith(JSON.stringify(data));
    });

    it('should handle different status codes', () => {
        const res = createMockResponse();

        sendJson(res, 201, { created: true }, '*');

        expect(res.writeHead).toHaveBeenCalledWith(201, expect.any(Object));
    });

    it('should handle complex objects', () => {
        const res = createMockResponse();
        const data = {
            users: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }],
            meta: { total: 2 }
        };

        sendJson(res, 200, data, '*');

        expect(res._getJson()).toEqual(data);
    });

    it('should handle arrays', () => {
        const res = createMockResponse();

        sendJson(res, 200, [1, 2, 3], '*');

        expect(res._getJson()).toEqual([1, 2, 3]);
    });
});

// ============================================
// sendError Tests
// ============================================

describe('sendError', () => {
    it('should send error response with correct structure', () => {
        const res = createMockResponse();

        sendError(res, 404, 'Not found', 'http://localhost:5173');

        expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
        expect(res._getJson()).toEqual({ error: 'Not found' });
    });

    it('should handle 500 errors', () => {
        const res = createMockResponse();

        sendError(res, 500, 'Internal server error', '*');

        expect(res._getStatusCode()).toBe(500);
        expect(res._getJson()).toEqual({ error: 'Internal server error' });
    });

    it('should handle 400 bad request', () => {
        const res = createMockResponse();

        sendError(res, 400, 'Missing required field', '*');

        expect(res._getStatusCode()).toBe(400);
    });
});

// ============================================
// setCorsHeaders Tests
// ============================================

describe('setCorsHeaders', () => {
    it('should set default CORS headers', () => {
        const res = createMockResponse();

        setCorsHeaders(res, 'http://localhost:5173');

        expect(res.setHeader).toHaveBeenCalledWith(
            'Access-Control-Allow-Origin',
            'http://localhost:5173'
        );
        expect(res.setHeader).toHaveBeenCalledWith(
            'Access-Control-Allow-Methods',
            'GET, POST, OPTIONS'
        );
        expect(res.setHeader).toHaveBeenCalledWith(
            'Access-Control-Allow-Headers',
            'Content-Type'
        );
    });

    it('should allow custom methods', () => {
        const res = createMockResponse();

        setCorsHeaders(res, '*', ['GET', 'POST', 'PUT', 'DELETE']);

        expect(res.setHeader).toHaveBeenCalledWith(
            'Access-Control-Allow-Methods',
            'GET, POST, PUT, DELETE'
        );
    });

    it('should allow custom headers', () => {
        const res = createMockResponse();

        setCorsHeaders(res, '*', ['GET'], ['Content-Type', 'Authorization', 'X-Custom']);

        expect(res.setHeader).toHaveBeenCalledWith(
            'Access-Control-Allow-Headers',
            'Content-Type, Authorization, X-Custom'
        );
    });

    it('should handle wildcard origin', () => {
        const res = createMockResponse();

        setCorsHeaders(res, '*');

        expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    });
});

// ============================================
// handlePreflight Tests
// ============================================

describe('handlePreflight', () => {
    it('should return true and respond 200 for OPTIONS requests', () => {
        const req = createMockRequest({ method: 'OPTIONS' });
        const res = createMockResponse();

        const result = handlePreflight(req, res);

        expect(result).toBe(true);
        expect(res.writeHead).toHaveBeenCalledWith(200);
        expect(res.end).toHaveBeenCalled();
    });

    it('should return false for non-OPTIONS requests', () => {
        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

        for (const method of methods) {
            const req = createMockRequest({ method });
            const res = createMockResponse();

            const result = handlePreflight(req, res);

            expect(result).toBe(false);
            expect(res.writeHead).not.toHaveBeenCalled();
        }
    });
});

// ============================================
// getHealthStatus Tests
// ============================================

describe('getHealthStatus', () => {
    it('should return health status object', () => {
        const result = getHealthStatus('test-service');

        expect(result).toHaveProperty('status', 'ok');
        expect(result).toHaveProperty('service', 'test-service');
        expect(result).toHaveProperty('uptime');
        expect(result).toHaveProperty('timestamp');
    });

    it('should include valid uptime', () => {
        const result = getHealthStatus('test');

        expect(typeof result.uptime).toBe('number');
        expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('should include valid ISO timestamp', () => {
        const result = getHealthStatus('test');

        expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should use provided service name', () => {
        expect(getHealthStatus('sonos-proxy').service).toBe('sonos-proxy');
        expect(getHealthStatus('tapo-proxy').service).toBe('tapo-proxy');
        expect(getHealthStatus('news-proxy').service).toBe('news-proxy');
    });
});

// ============================================
// logRequest Tests
// ============================================

describe('logRequest', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    it('should log request method and URL', () => {
        const req = createMockRequest({ method: 'GET', url: '/health' });

        logRequest(req);

        expect(console.log).toHaveBeenCalled();
        const logMessage = console.log.mock.calls[0][0];
        expect(logMessage).toContain('GET');
        expect(logMessage).toContain('/health');
    });

    it('should include timestamp', () => {
        const req = createMockRequest({ method: 'POST', url: '/data' });

        logRequest(req);

        const logMessage = console.log.mock.calls[0][0];
        // Check for ISO date format in log
        expect(logMessage).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should log POST requests', () => {
        const req = createMockRequest({ method: 'POST', url: '/api/endpoint' });

        logRequest(req);

        const logMessage = console.log.mock.calls[0][0];
        expect(logMessage).toContain('POST');
        expect(logMessage).toContain('/api/endpoint');
    });
});
