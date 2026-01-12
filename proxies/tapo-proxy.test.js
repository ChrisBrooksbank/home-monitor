/**
 * Unit tests for tapo-proxy.js
 * Tests Tapo plug discovery and control functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    getPlugIP,
    isAllowedOrigin,
    MANUAL_PLUGS,
    REDISCOVERY_INTERVAL,
    _setDiscoveredPlugs,
    _resetDiscoveredPlugs
} from './tapo-proxy.js';

// ============================================
// getPlugIP Tests
// ============================================

describe('getPlugIP', () => {
    beforeEach(() => {
        _resetDiscoveredPlugs();
    });

    afterEach(() => {
        _resetDiscoveredPlugs();
    });

    it('should return IP for discovered plug', () => {
        _setDiscoveredPlugs({
            'bedroom-plug': { ip: '192.168.68.50', nickname: 'Bedroom Plug' }
        });

        const ip = getPlugIP('bedroom-plug');

        expect(ip).toBe('192.168.68.50');
    });

    it('should return null for unknown plug', () => {
        _setDiscoveredPlugs({
            'bedroom-plug': { ip: '192.168.68.50', nickname: 'Bedroom Plug' }
        });

        const ip = getPlugIP('unknown-plug');

        expect(ip).toBeNull();
    });

    it('should be case sensitive', () => {
        _setDiscoveredPlugs({
            'bedroom-plug': { ip: '192.168.68.50', nickname: 'Bedroom Plug' }
        });

        expect(getPlugIP('Bedroom-Plug')).toBeNull();
        expect(getPlugIP('BEDROOM-PLUG')).toBeNull();
    });

    it('should return null for empty discovered plugs', () => {
        _resetDiscoveredPlugs();

        const ip = getPlugIP('any-plug');

        expect(ip).toBeNull();
    });

    it('should handle multiple plugs', () => {
        _setDiscoveredPlugs({
            'plug-1': { ip: '192.168.68.50', nickname: 'Plug 1' },
            'plug-2': { ip: '192.168.68.51', nickname: 'Plug 2' },
            'plug-3': { ip: '192.168.68.52', nickname: 'Plug 3' }
        });

        expect(getPlugIP('plug-1')).toBe('192.168.68.50');
        expect(getPlugIP('plug-2')).toBe('192.168.68.51');
        expect(getPlugIP('plug-3')).toBe('192.168.68.52');
    });
});

// ============================================
// isAllowedOrigin Tests
// ============================================

describe('isAllowedOrigin', () => {
    it('should return true for null origin (server-to-server)', () => {
        expect(isAllowedOrigin(null)).toBe(true);
    });

    it('should return true for undefined origin', () => {
        expect(isAllowedOrigin(undefined)).toBe(true);
    });

    it('should return true for default frontend origin', () => {
        expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
    });

    it('should return true for any localhost port', () => {
        expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
        expect(isAllowedOrigin('http://localhost:8080')).toBe(true);
        expect(isAllowedOrigin('http://localhost:1')).toBe(true);
        expect(isAllowedOrigin('http://localhost:65535')).toBe(true);
    });

    it('should return false for non-localhost origins', () => {
        expect(isAllowedOrigin('http://example.com')).toBe(false);
        expect(isAllowedOrigin('https://evil-site.com')).toBe(false);
        expect(isAllowedOrigin('http://192.168.1.1')).toBe(false);
    });

    it('should return false for https localhost', () => {
        expect(isAllowedOrigin('https://localhost:5173')).toBe(false);
    });

    it('should return false for localhost without port', () => {
        expect(isAllowedOrigin('http://localhost')).toBe(false);
    });
});

// ============================================
// MANUAL_PLUGS Tests
// ============================================

describe('MANUAL_PLUGS', () => {
    it('should be defined', () => {
        expect(MANUAL_PLUGS).toBeDefined();
    });

    it('should contain plug entries with required fields', () => {
        for (const [key, plug] of Object.entries(MANUAL_PLUGS)) {
            expect(plug).toHaveProperty('ip');
            expect(plug).toHaveProperty('nickname');
            expect(plug.ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
        }
    });
});

// ============================================
// REDISCOVERY_INTERVAL Tests
// ============================================

describe('REDISCOVERY_INTERVAL', () => {
    it('should be 5 minutes in milliseconds', () => {
        expect(REDISCOVERY_INTERVAL).toBe(5 * 60 * 1000);
    });
});

// ============================================
// Discovery Logic Tests (mocked)
// ============================================

describe('Discovery state management', () => {
    beforeEach(() => {
        _resetDiscoveredPlugs();
    });

    it('_setDiscoveredPlugs should set plugs', () => {
        _setDiscoveredPlugs({
            'test-plug': { ip: '192.168.68.100', nickname: 'Test Plug' }
        });

        expect(getPlugIP('test-plug')).toBe('192.168.68.100');
    });

    it('_resetDiscoveredPlugs should clear all plugs', () => {
        _setDiscoveredPlugs({
            'plug-1': { ip: '192.168.68.50', nickname: 'Plug 1' },
            'plug-2': { ip: '192.168.68.51', nickname: 'Plug 2' }
        });

        _resetDiscoveredPlugs();

        expect(getPlugIP('plug-1')).toBeNull();
        expect(getPlugIP('plug-2')).toBeNull();
    });

    it('_setDiscoveredPlugs should replace existing plugs', () => {
        _setDiscoveredPlugs({
            'old-plug': { ip: '192.168.68.50', nickname: 'Old' }
        });

        _setDiscoveredPlugs({
            'new-plug': { ip: '192.168.68.60', nickname: 'New' }
        });

        expect(getPlugIP('old-plug')).toBeNull();
        expect(getPlugIP('new-plug')).toBe('192.168.68.60');
    });
});
