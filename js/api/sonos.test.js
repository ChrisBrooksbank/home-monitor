/**
 * Unit tests for sonos.js
 * Tests Sonos speaker API functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SonosAPI } from './sonos.js';

// ============================================
// Mock Setup
// ============================================

// Mock APP_CONFIG
globalThis.APP_CONFIG = {
    proxies: {
        sonos: 'http://localhost:3000'
    },
    timeouts: {
        apiRequest: 10000,
        proxyCheck: 5000
    }
};

// Mock Logger - reset in beforeEach
const createLoggerMock = () => ({
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    warn: vi.fn()
});
globalThis.Logger = createLoggerMock();

// Mock retryWithBackoff - just executes the function directly
globalThis.retryWithBackoff = (fn) => fn();

// Mock checkProxyAvailability
globalThis.checkProxyAvailability = vi.fn();

// ============================================
// SonosAPI.buildSoapXml Tests
// ============================================

describe('SonosAPI.buildSoapXml', () => {
    it('should build correct XML for AVTransport service', () => {
        const xml = SonosAPI.buildSoapXml('Play', 'AVTransport', { InstanceID: 0, Speed: 1 });

        expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>');
        expect(xml).toContain('xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"');
        expect(xml).toContain('<u:Play');
        expect(xml).toContain('<InstanceID>0</InstanceID>');
        expect(xml).toContain('<Speed>1</Speed>');
    });

    it('should build correct XML for RenderingControl service', () => {
        const xml = SonosAPI.buildSoapXml('GetVolume', 'RenderingControl', { InstanceID: 0, Channel: 'Master' });

        expect(xml).toContain('xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"');
        expect(xml).toContain('<u:GetVolume');
        expect(xml).toContain('<Channel>Master</Channel>');
    });

    it('should skip null parameters', () => {
        const xml = SonosAPI.buildSoapXml('SetVolume', 'RenderingControl', {
            InstanceID: 0,
            Channel: 'Master',
            DesiredVolume: null
        });

        expect(xml).toContain('<InstanceID>0</InstanceID>');
        expect(xml).toContain('<Channel>Master</Channel>');
        expect(xml).not.toContain('<DesiredVolume>');
    });

    it('should include non-null parameters', () => {
        const xml = SonosAPI.buildSoapXml('SetVolume', 'RenderingControl', {
            InstanceID: 0,
            Channel: 'Master',
            DesiredVolume: 50
        });

        expect(xml).toContain('<DesiredVolume>50</DesiredVolume>');
    });
});

// ============================================
// SonosAPI.soapRequest Tests
// ============================================

describe('SonosAPI.soapRequest', () => {
    beforeEach(() => {
        globalThis.Logger = createLoggerMock();
    });

    it('should send POST request with correct headers', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: () => Promise.resolve('<response>OK</response>')
        });

        const result = await SonosAPI.soapRequest(
            '192.168.68.55',
            '/MediaRenderer/AVTransport/Control',
            '"urn:schemas-upnp-org:service:AVTransport:1#Play"',
            '<soap>body</soap>'
        );

        expect(result.ok).toBe(true);
        expect(result.body).toBe('<response>OK</response>');
        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:3000/MediaRenderer/AVTransport/Control',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    'Content-Type': 'text/xml; charset="utf-8"',
                    'SOAPAction': '"urn:schemas-upnp-org:service:AVTransport:1#Play"',
                    'X-Sonos-IP': '192.168.68.55'
                },
                body: '<soap>body</soap>'
            })
        );
    });

    it('should return error on network failure', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const result = await SonosAPI.soapRequest('192.168.68.55', '/path', 'action', 'body');

        expect(result.ok).toBe(false);
        expect(result.error).toBe('Network error');
        expect(Logger.error).toHaveBeenCalled();
    });

    it('should return status on HTTP error', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            text: () => Promise.resolve('Error')
        });

        const result = await SonosAPI.soapRequest('192.168.68.55', '/path', 'action', 'body');

        expect(result.ok).toBe(false);
        expect(result.status).toBe(500);
    });
});

// ============================================
// SonosAPI.command Tests
// ============================================

describe('SonosAPI.command', () => {
    beforeEach(() => {
        globalThis.Logger = createLoggerMock();
    });

    it('should return error for unknown command', async () => {
        const result = await SonosAPI.command('192.168.68.55', 'UnknownCommand');

        expect(result.ok).toBe(false);
        expect(result.error).toBe('Unknown command');
        expect(Logger.error).toHaveBeenCalledWith('Unknown Sonos command: UnknownCommand');
    });

    it('should execute valid command', async () => {
        let retryFunctionCalled = false;
        globalThis.retryWithBackoff = vi.fn((fn) => {
            retryFunctionCalled = true;
            return fn();
        });
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: () => Promise.resolve('<response>OK</response>')
        });

        const result = await SonosAPI.command('192.168.68.55', 'Play');

        expect(result.ok).toBe(true);
        expect(retryFunctionCalled).toBe(true);
    });

    it('should merge extra params with template params', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: () => Promise.resolve('<response>OK</response>')
        });

        await SonosAPI.command('192.168.68.55', 'SetVolume', { DesiredVolume: 75 });

        // Check that the SOAP body includes the volume
        expect(fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                body: expect.stringContaining('<DesiredVolume>75</DesiredVolume>')
            })
        );
    });
});

// ============================================
// SonosAPI.play Tests
// ============================================

describe('SonosAPI.play', () => {
    beforeEach(() => {
        globalThis.Logger = createLoggerMock();
    });

    it('should send Play command and return true on success', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: () => Promise.resolve('<response>OK</response>')
        });

        const result = await SonosAPI.play('192.168.68.55');

        expect(result).toBe(true);
        expect(Logger.info).toHaveBeenCalledWith('Playing on Sonos speaker 192.168.68.55');
    });

    it('should return false on failure', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            text: () => Promise.resolve('Error')
        });

        const result = await SonosAPI.play('192.168.68.55');

        expect(result).toBe(false);
    });
});

// ============================================
// SonosAPI.pause Tests
// ============================================

describe('SonosAPI.pause', () => {
    beforeEach(() => {
        globalThis.Logger = createLoggerMock();
    });

    it('should send Pause command and return true on success', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: () => Promise.resolve('<response>OK</response>')
        });

        const result = await SonosAPI.pause('192.168.68.55');

        expect(result).toBe(true);
        expect(Logger.info).toHaveBeenCalledWith('Pausing Sonos speaker 192.168.68.55');
    });
});

// ============================================
// SonosAPI.getVolume Tests
// ============================================

describe('SonosAPI.getVolume', () => {
    beforeEach(() => {
        globalThis.Logger = createLoggerMock();
    });

    it('should parse volume from response', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: () => Promise.resolve('<CurrentVolume>42</CurrentVolume>')
        });

        const volume = await SonosAPI.getVolume('192.168.68.55');

        expect(volume).toBe(42);
    });

    it('should return 0 on parse failure', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: () => Promise.resolve('<SomeOther>data</SomeOther>')
        });

        const volume = await SonosAPI.getVolume('192.168.68.55');

        expect(volume).toBe(0);
    });

    it('should return 0 on request failure', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            text: () => Promise.resolve('Error')
        });

        const volume = await SonosAPI.getVolume('192.168.68.55');

        expect(volume).toBe(0);
    });
});

// ============================================
// SonosAPI.setVolume Tests
// ============================================

describe('SonosAPI.setVolume', () => {
    beforeEach(() => {
        globalThis.Logger = createLoggerMock();
    });

    it('should send SetVolume command with volume value', async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: () => Promise.resolve('<response>OK</response>')
        });

        const result = await SonosAPI.setVolume('192.168.68.55', 50);

        expect(result).toBe(true);
        expect(Logger.info).toHaveBeenCalledWith('Setting Sonos 192.168.68.55 volume to 50');
    });
});

// ============================================
// SonosAPI.changeVolume Tests
// ============================================

describe('SonosAPI.changeVolume', () => {
    beforeEach(() => {
        globalThis.Logger = createLoggerMock();
    });

    it('should increase volume by delta', async () => {
        let callCount = 0;
        globalThis.fetch = vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // getVolume call
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve('<CurrentVolume>50</CurrentVolume>')
                });
            } else {
                // setVolume call
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve('<response>OK</response>')
                });
            }
        });

        await SonosAPI.changeVolume('192.168.68.55', 5);

        // Check that setVolume was called with 55
        expect(Logger.info).toHaveBeenCalledWith('Setting Sonos 192.168.68.55 volume to 55');
    });

    it('should clamp volume to 0', async () => {
        let callCount = 0;
        globalThis.fetch = vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve('<CurrentVolume>5</CurrentVolume>')
                });
            } else {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve('<response>OK</response>')
                });
            }
        });

        await SonosAPI.changeVolume('192.168.68.55', -10);

        expect(Logger.info).toHaveBeenCalledWith('Setting Sonos 192.168.68.55 volume to 0');
    });

    it('should clamp volume to 100', async () => {
        let callCount = 0;
        globalThis.fetch = vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve('<CurrentVolume>95</CurrentVolume>')
                });
            } else {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    text: () => Promise.resolve('<response>OK</response>')
                });
            }
        });

        await SonosAPI.changeVolume('192.168.68.55', 10);

        expect(Logger.info).toHaveBeenCalledWith('Setting Sonos 192.168.68.55 volume to 100');
    });
});

// ============================================
// SonosAPI.getSpeakers Tests
// ============================================

describe('SonosAPI.getSpeakers', () => {
    beforeEach(() => {
        globalThis.Logger = createLoggerMock();
    });

    it('should return speakers list on success', async () => {
        const mockSpeakers = {
            speakers: {
                'lounge': { ip: '192.168.68.55', room: 'Lounge' },
                'bedroom': { ip: '192.168.68.56', room: 'Bedroom' }
            },
            count: 2
        };
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockSpeakers)
        });

        const result = await SonosAPI.getSpeakers();

        expect(result).toEqual(mockSpeakers);
        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:3000/speakers',
            expect.objectContaining({ method: 'GET' })
        );
    });

    it('should return empty object on error', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

        const result = await SonosAPI.getSpeakers();

        expect(result).toEqual({ speakers: {}, count: 0 });
        expect(Logger.error).toHaveBeenCalled();
    });
});

// ============================================
// SonosAPI.discover Tests
// ============================================

describe('SonosAPI.discover', () => {
    beforeEach(() => {
        globalThis.Logger = createLoggerMock();
    });

    it('should trigger discovery and return results', async () => {
        const mockResult = {
            success: true,
            count: 2,
            speakers: { 'lounge': {}, 'bedroom': {} }
        };
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockResult)
        });

        const result = await SonosAPI.discover();

        expect(result).toEqual(mockResult);
        expect(fetch).toHaveBeenCalledWith(
            'http://localhost:3000/discover',
            expect.objectContaining({ method: 'POST' })
        );
        expect(Logger.info).toHaveBeenCalledWith('Starting Sonos speaker discovery...');
        expect(Logger.success).toHaveBeenCalledWith('Discovered 2 Sonos speakers');
    });

    it('should throw on error', async () => {
        globalThis.fetch = vi.fn().mockRejectedValue(new Error('Discovery failed'));

        await expect(SonosAPI.discover()).rejects.toThrow('Discovery failed');
        expect(Logger.error).toHaveBeenCalled();
    });
});

// ============================================
// SonosAPI.checkAvailability Tests
// ============================================

describe('SonosAPI.checkAvailability', () => {
    beforeEach(() => {
        globalThis.checkProxyAvailability = vi.fn();
    });

    it('should delegate to checkProxyAvailability', async () => {
        globalThis.checkProxyAvailability = vi.fn().mockResolvedValue(true);

        const result = await SonosAPI.checkAvailability();

        expect(result).toBe(true);
        expect(checkProxyAvailability).toHaveBeenCalledWith(
            'http://localhost:3000/speakers',
            'Sonos'
        );
    });
});
