/**
 * Unit tests for sonos.ts
 * Tests Sonos speaker API functions
 */

import { describe, it, expect, vi, beforeEach, type Mock, type MockInstance } from 'vitest';
import type { AppConfig } from '../types';

// ============================================
// Mock Setup - Module mocks before imports
// ============================================

// Mock the helpers module
vi.mock('../utils/helpers', () => ({
  retryWithBackoff: vi.fn(<T>(fn: () => Promise<T>) => fn()),
}));

// Now import the module under test and Logger (to spy on)
import { SonosAPI } from './sonos';
import { Logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/helpers';

// Set up APP_CONFIG global
(globalThis as typeof globalThis & { APP_CONFIG: AppConfig }).APP_CONFIG = {
  proxies: {
    sonos: 'http://localhost:3000',
    tapo: 'http://localhost:3001',
    shield: 'http://localhost:8082',
  },
  timeouts: {
    apiRequest: 10000,
    proxyCheck: 5000,
  },
  intervals: {
    motionSensors: 3000,
    lights: 10000,
    sensorDetails: 10000,
    temperatures: 60000,
    motionLog: 60000,
    sky: 60000,
    sunTimes: 86400000,
    weather: 900000,
    nest: 900000,
    sonosVolume: 30000,
    tapoStatus: 30000,
    connectionStatus: 30000,
  },
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },
  debug: false,
};

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
    const xml = SonosAPI.buildSoapXml('GetVolume', 'RenderingControl', {
      InstanceID: 0,
      Channel: 'Master',
    });

    expect(xml).toContain('xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1"');
    expect(xml).toContain('<u:GetVolume');
    expect(xml).toContain('<Channel>Master</Channel>');
  });

  it('should skip null parameters', () => {
    const xml = SonosAPI.buildSoapXml('SetVolume', 'RenderingControl', {
      InstanceID: 0,
      Channel: 'Master',
      DesiredVolume: null,
    });

    expect(xml).toContain('<InstanceID>0</InstanceID>');
    expect(xml).toContain('<Channel>Master</Channel>');
    expect(xml).not.toContain('<DesiredVolume>');
  });

  it('should include non-null parameters', () => {
    const xml = SonosAPI.buildSoapXml('SetVolume', 'RenderingControl', {
      InstanceID: 0,
      Channel: 'Master',
      DesiredVolume: 50,
    });

    expect(xml).toContain('<DesiredVolume>50</DesiredVolume>');
  });
});

// ============================================
// SonosAPI.soapRequest Tests
// ============================================

describe('SonosAPI.soapRequest', () => {
  let errorSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    errorSpy = vi.spyOn(Logger, 'error');
  });

  it('should send POST request with correct headers', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<response>OK</response>'),
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
          SOAPAction: '"urn:schemas-upnp-org:service:AVTransport:1#Play"',
          'X-Sonos-IP': '192.168.68.55',
        },
        body: '<soap>body</soap>',
      })
    );
  });

  it('should return error on network failure', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi
      .fn()
      .mockRejectedValue(new Error('Network error'));

    const result = await SonosAPI.soapRequest('192.168.68.55', '/path', 'action', 'body');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Network error');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('should return status on HTTP error', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Error'),
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
  let errorSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    errorSpy = vi.spyOn(Logger, 'error');
  });

  it('should return error for unknown command', async () => {
    const result = await SonosAPI.command('192.168.68.55', 'UnknownCommand' as 'Play');

    expect(result.ok).toBe(false);
    expect(result.error).toBe('Unknown command');
    expect(errorSpy).toHaveBeenCalledWith('Unknown Sonos command: UnknownCommand');
  });

  it('should execute valid command', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<response>OK</response>'),
    });

    const result = await SonosAPI.command('192.168.68.55', 'Play');

    expect(result.ok).toBe(true);
    expect(retryWithBackoff).toHaveBeenCalled();
  });

  it('should merge extra params with template params', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<response>OK</response>'),
    });

    await SonosAPI.command('192.168.68.55', 'SetVolume', { DesiredVolume: 75 });

    // Check that the SOAP body includes the volume
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: expect.stringContaining('<DesiredVolume>75</DesiredVolume>'),
      })
    );
  });
});

// ============================================
// SonosAPI.play Tests
// ============================================

describe('SonosAPI.play', () => {
  let infoSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    infoSpy = vi.spyOn(Logger, 'info');
  });

  it('should send Play command and return true on success', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<response>OK</response>'),
    });

    const result = await SonosAPI.play('192.168.68.55');

    expect(result).toBe(true);
    expect(infoSpy).toHaveBeenCalledWith('Playing on Sonos speaker 192.168.68.55');
  });

  it('should return false on failure', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Error'),
    });

    const result = await SonosAPI.play('192.168.68.55');

    expect(result).toBe(false);
  });
});

// ============================================
// SonosAPI.pause Tests
// ============================================

describe('SonosAPI.pause', () => {
  let infoSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    infoSpy = vi.spyOn(Logger, 'info');
  });

  it('should send Pause command and return true on success', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<response>OK</response>'),
    });

    const result = await SonosAPI.pause('192.168.68.55');

    expect(result).toBe(true);
    expect(infoSpy).toHaveBeenCalledWith('Pausing Sonos speaker 192.168.68.55');
  });
});

// ============================================
// SonosAPI.getVolume Tests
// ============================================

describe('SonosAPI.getVolume', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should parse volume from response', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<CurrentVolume>42</CurrentVolume>'),
    });

    const volume = await SonosAPI.getVolume('192.168.68.55');

    expect(volume).toBe(42);
  });

  it('should return 0 on parse failure', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<SomeOther>data</SomeOther>'),
    });

    const volume = await SonosAPI.getVolume('192.168.68.55');

    expect(volume).toBe(0);
  });

  it('should return 0 on request failure', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Error'),
    });

    const volume = await SonosAPI.getVolume('192.168.68.55');

    expect(volume).toBe(0);
  });
});

// ============================================
// SonosAPI.setVolume Tests
// ============================================

describe('SonosAPI.setVolume', () => {
  let infoSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    infoSpy = vi.spyOn(Logger, 'info');
  });

  it('should send SetVolume command with volume value', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<response>OK</response>'),
    });

    const result = await SonosAPI.setVolume('192.168.68.55', 50);

    expect(result).toBe(true);
    expect(infoSpy).toHaveBeenCalledWith('Setting Sonos 192.168.68.55 volume to 50');
  });
});

// ============================================
// SonosAPI.changeVolume Tests
// ============================================

describe('SonosAPI.changeVolume', () => {
  let infoSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    infoSpy = vi.spyOn(Logger, 'info');
  });

  it('should increase volume by delta', async () => {
    let callCount = 0;
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // getVolume call
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('<CurrentVolume>50</CurrentVolume>'),
        });
      } else {
        // setVolume call
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('<response>OK</response>'),
        });
      }
    });

    await SonosAPI.changeVolume('192.168.68.55', 5);

    // Check that setVolume was called with 55
    expect(infoSpy).toHaveBeenCalledWith('Setting Sonos 192.168.68.55 volume to 55');
  });

  it('should clamp volume to 0', async () => {
    let callCount = 0;
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('<CurrentVolume>5</CurrentVolume>'),
        });
      } else {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('<response>OK</response>'),
        });
      }
    });

    await SonosAPI.changeVolume('192.168.68.55', -10);

    expect(infoSpy).toHaveBeenCalledWith('Setting Sonos 192.168.68.55 volume to 0');
  });

  it('should clamp volume to 100', async () => {
    let callCount = 0;
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('<CurrentVolume>95</CurrentVolume>'),
        });
      } else {
        return Promise.resolve({
          ok: true,
          status: 200,
          text: () => Promise.resolve('<response>OK</response>'),
        });
      }
    });

    await SonosAPI.changeVolume('192.168.68.55', 10);

    expect(infoSpy).toHaveBeenCalledWith('Setting Sonos 192.168.68.55 volume to 100');
  });
});

// ============================================
// SonosAPI.getSpeakers Tests
// ============================================

describe('SonosAPI.getSpeakers', () => {
  let errorSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    errorSpy = vi.spyOn(Logger, 'error');
  });

  it('should return speakers list on success', async () => {
    const mockSpeakers = {
      speakers: {
        lounge: { ip: '192.168.68.55', room: 'Lounge' },
        bedroom: { ip: '192.168.68.56', room: 'Bedroom' },
      },
      count: 2,
    };
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSpeakers),
    });

    const result = await SonosAPI.getSpeakers();

    expect(result).toEqual(mockSpeakers);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/speakers',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should return empty object on error', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi
      .fn()
      .mockRejectedValue(new Error('Network error'));

    const result = await SonosAPI.getSpeakers();

    expect(result).toEqual({ speakers: {}, lastDiscovery: null, count: 0 });
    expect(errorSpy).toHaveBeenCalled();
  });
});

// ============================================
// SonosAPI.discover Tests
// ============================================

describe('SonosAPI.discover', () => {
  let infoSpy: MockInstance;
  let successSpy: MockInstance;
  let errorSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    infoSpy = vi.spyOn(Logger, 'info');
    successSpy = vi.spyOn(Logger, 'success');
    errorSpy = vi.spyOn(Logger, 'error');
  });

  it('should trigger discovery and return results', async () => {
    const mockResult = {
      success: true,
      count: 2,
      speakers: { lounge: {}, bedroom: {} },
    };
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    const result = await SonosAPI.discover();

    expect(result).toEqual(mockResult);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/discover',
      expect.objectContaining({ method: 'POST' })
    );
    expect(infoSpy).toHaveBeenCalledWith('Starting Sonos speaker discovery...');
    expect(successSpy).toHaveBeenCalledWith('Discovered 2 Sonos speakers');
  });

  it('should throw on error', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi
      .fn()
      .mockRejectedValue(new Error('Discovery failed'));

    await expect(SonosAPI.discover()).rejects.toThrow('Discovery failed');
    expect(errorSpy).toHaveBeenCalled();
  });
});

// ============================================
// SonosAPI.checkAvailability Tests
// ============================================

describe('SonosAPI.checkAvailability', () => {
  let successSpy: MockInstance;
  let warnSpy: MockInstance;

  beforeEach(() => {
    vi.resetAllMocks();
    successSpy = vi.spyOn(Logger, 'success');
    warnSpy = vi.spyOn(Logger, 'warn');
  });

  it('should return true when proxy is available', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
    });

    const result = await SonosAPI.checkAvailability();

    expect(result).toBe(true);
    expect(successSpy).toHaveBeenCalledWith('Sonos proxy is available');
  });

  it('should return false when proxy returns non-ok response', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: false,
    });

    const result = await SonosAPI.checkAvailability();

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('should return false when fetch fails', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi
      .fn()
      .mockRejectedValue(new Error('Network error'));

    const result = await SonosAPI.checkAvailability();

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('should use HEAD method', async () => {
    (globalThis as typeof globalThis & { fetch: Mock }).fetch = vi.fn().mockResolvedValue({
      ok: true,
    });

    await SonosAPI.checkAvailability();

    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:3000/speakers',
      expect.objectContaining({ method: 'HEAD' })
    );
  });
});
