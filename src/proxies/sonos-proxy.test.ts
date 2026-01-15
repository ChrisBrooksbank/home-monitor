/**
 * Unit tests for sonos-proxy.ts
 * Tests Sonos speaker discovery and control functions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getSpeakerIP,
  _setDiscoveredSpeakers,
  _resetDiscoveredSpeakers,
} from './sonos-proxy';

// ============================================
// getSpeakerIP Tests
// ============================================

describe('getSpeakerIP', () => {
  beforeEach(() => {
    _resetDiscoveredSpeakers();
  });

  afterEach(() => {
    _resetDiscoveredSpeakers();
  });

  it('should return IP for discovered speaker', () => {
    _setDiscoveredSpeakers({
      lounge: { ip: '192.168.68.55', room: 'Lounge', model: 'Sonos One' },
    });

    const ip = getSpeakerIP('lounge');

    expect(ip).toBe('192.168.68.55');
  });

  it('should return null for unknown speaker', () => {
    _setDiscoveredSpeakers({
      lounge: { ip: '192.168.68.55', room: 'Lounge', model: 'Sonos One' },
    });

    const ip = getSpeakerIP('bedroom');

    expect(ip).toBeNull();
  });

  it('should be case sensitive', () => {
    _setDiscoveredSpeakers({
      lounge: { ip: '192.168.68.55', room: 'Lounge', model: 'Sonos One' },
    });

    expect(getSpeakerIP('Lounge')).toBeNull();
    expect(getSpeakerIP('LOUNGE')).toBeNull();
  });

  it('should return null for empty discovered speakers', () => {
    _resetDiscoveredSpeakers();

    const ip = getSpeakerIP('any-speaker');

    expect(ip).toBeNull();
  });

  it('should handle multiple speakers', () => {
    _setDiscoveredSpeakers({
      lounge: { ip: '192.168.68.55', room: 'Lounge', model: 'Sonos One' },
      bedroom: { ip: '192.168.68.56', room: 'Bedroom', model: 'Sonos One' },
      office: { ip: '192.168.68.57', room: 'Office', model: 'Sonos Move' },
    });

    expect(getSpeakerIP('lounge')).toBe('192.168.68.55');
    expect(getSpeakerIP('bedroom')).toBe('192.168.68.56');
    expect(getSpeakerIP('office')).toBe('192.168.68.57');
  });

  it('should handle duplicate room names with suffix', () => {
    _setDiscoveredSpeakers({
      lounge: { ip: '192.168.68.55', room: 'Lounge', model: 'Sonos One' },
      'lounge-2': { ip: '192.168.68.56', room: 'Lounge', model: 'Sonos One' },
    });

    expect(getSpeakerIP('lounge')).toBe('192.168.68.55');
    expect(getSpeakerIP('lounge-2')).toBe('192.168.68.56');
  });
});

// ============================================
// Discovery State Management Tests
// ============================================

describe('Discovery state management', () => {
  beforeEach(() => {
    _resetDiscoveredSpeakers();
  });

  it('_setDiscoveredSpeakers should set speakers', () => {
    _setDiscoveredSpeakers({
      'test-room': { ip: '192.168.68.100', room: 'Test Room', model: 'Sonos One' },
    });

    expect(getSpeakerIP('test-room')).toBe('192.168.68.100');
  });

  it('_resetDiscoveredSpeakers should clear all speakers', () => {
    _setDiscoveredSpeakers({
      'room-1': { ip: '192.168.68.50', room: 'Room 1', model: 'Sonos One' },
      'room-2': { ip: '192.168.68.51', room: 'Room 2', model: 'Sonos One' },
    });

    _resetDiscoveredSpeakers();

    expect(getSpeakerIP('room-1')).toBeNull();
    expect(getSpeakerIP('room-2')).toBeNull();
  });

  it('_setDiscoveredSpeakers should replace existing speakers', () => {
    _setDiscoveredSpeakers({
      'old-room': { ip: '192.168.68.50', room: 'Old', model: 'Sonos One' },
    });

    _setDiscoveredSpeakers({
      'new-room': { ip: '192.168.68.60', room: 'New', model: 'Sonos One' },
    });

    expect(getSpeakerIP('old-room')).toBeNull();
    expect(getSpeakerIP('new-room')).toBe('192.168.68.60');
  });
});
