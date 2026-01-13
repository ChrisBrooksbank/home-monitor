/**
 * Sonos Speaker UI Module
 * Renders speaker controls with play, pause, volume up/down buttons
 *
 * Uses centralized AppState for speaker state management.
 */

import { Logger } from '../utils/logger';
import { AppState } from '../core';
import { SonosAPI } from '../api';
import { APP_CONFIG } from '../config';
import type { SonosSpeaker } from '../types';

// Extend Window interface with SonosUI
declare global {
  interface Window {
    SonosUI?: typeof SonosUI;
  }
}

// Helper functions to access AppState
const getSpeakers = (): Record<string, SonosSpeaker> =>
  (AppState?.get('speakers') as Record<string, SonosSpeaker>) || {};
const getSpeakerVolumes = (): Record<string, number> =>
  (AppState?.get('speakerVolumes') as Record<string, number>) || {};
const setSpeakers = (speakers: Record<string, SonosSpeaker>): void => {
  AppState?.set('speakers', speakers);
};
const setSpeakerVolume = (id: string, volume: number): void => {
  AppState?.set(`speakerVolumes.${id}`, volume);
};

/**
 * Fetch speakers from proxy
 */
async function fetchSpeakers(): Promise<Record<string, SonosSpeaker>> {
  try {
    const data = await SonosAPI.getSpeakers();
    const speakers = data.speakers || {};
    setSpeakers(speakers);
    return speakers;
  } catch (error) {
    Logger.error('Failed to fetch Sonos speakers:', error);
    return {};
  }
}

/**
 * Create SVG speaker control panel with buttons
 */
function createSpeakerControl(id: string, speaker: SonosSpeaker): SVGGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const group = document.createElementNS(ns, 'g');
  group.id = `sonos-${id}-controls`;
  group.setAttribute('class', 'sonos-speaker-control');
  group.setAttribute('data-speaker-id', id);

  // Set innerHTML with all control elements
  group.innerHTML = `
    <!-- Control Panel Background -->
    <rect x="-35" y="-18" width="70" height="36" rx="5" fill="#2C3E50" opacity="0.85" stroke="#34495E" stroke-width="1.5"/>

    <!-- Title -->
    <text x="0" y="-8" text-anchor="middle" fill="#BDC3C7" font-size="7" font-weight="bold">${speaker.room || id}</text>

    <!-- Play Button -->
    <g id="sonos-${id}-play" class="sonos-button" transform="translate(-20, 5)" style="cursor: pointer;">
      <circle r="8" fill="#27AE60" stroke="#1E8449" stroke-width="1"/>
      <polygon points="-2.5,-3.5 -2.5,3.5 3.5,0" fill="white"/>
    </g>

    <!-- Pause Button -->
    <g id="sonos-${id}-pause" class="sonos-button" transform="translate(-5, 5)" style="cursor: pointer;">
      <circle r="8" fill="#E67E22" stroke="#CA6F1E" stroke-width="1"/>
      <rect x="-3" y="-3.5" width="2" height="7" fill="white"/>
      <rect x="1" y="-3.5" width="2" height="7" fill="white"/>
    </g>

    <!-- Volume Down Button -->
    <g id="sonos-${id}-voldown" class="sonos-button" transform="translate(10, 5)" style="cursor: pointer;">
      <circle r="7" fill="#3498DB" stroke="#2980B9" stroke-width="1"/>
      <text x="0" y="2.5" text-anchor="middle" fill="white" font-size="11" font-weight="bold">-</text>
    </g>

    <!-- Volume Up Button -->
    <g id="sonos-${id}-volup" class="sonos-button" transform="translate(23, 5)" style="cursor: pointer;">
      <circle r="7" fill="#3498DB" stroke="#2980B9" stroke-width="1"/>
      <text x="0" y="2.5" text-anchor="middle" fill="white" font-size="10" font-weight="bold">+</text>
    </g>

    <!-- Volume Label -->
    <text id="sonos-${id}-volume-label" x="0" y="25" text-anchor="middle" fill="#ECF0F1" font-size="6">Vol: --</text>
  `;

  return group;
}

/**
 * Setup event handlers for a speaker control
 */
function setupSpeakerControl(id: string, speaker: SonosSpeaker): void {
  const playBtn = document.getElementById(`sonos-${id}-play`);
  const pauseBtn = document.getElementById(`sonos-${id}-pause`);
  const volUpBtn = document.getElementById(`sonos-${id}-volup`);
  const volDownBtn = document.getElementById(`sonos-${id}-voldown`);

  if (playBtn) {
    playBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await SonosAPI.play(speaker.ip);
      Logger.info(`Playing on ${speaker.room}`);
    });
  }

  if (pauseBtn) {
    pauseBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await SonosAPI.pause(speaker.ip);
      Logger.info(`Paused ${speaker.room}`);
    });
  }

  if (volUpBtn) {
    volUpBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const volumes = getSpeakerVolumes();
      const currentVol = volumes[id] || 0;
      const newVol = Math.min(100, currentVol + 5);
      await SonosAPI.setVolume(speaker.ip, newVol);
      setSpeakerVolume(id, newVol);
      updateVolumeDisplay(id, newVol);
    });
  }

  if (volDownBtn) {
    volDownBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const volumes = getSpeakerVolumes();
      const currentVol = volumes[id] || 0;
      const newVol = Math.max(0, currentVol - 5);
      await SonosAPI.setVolume(speaker.ip, newVol);
      setSpeakerVolume(id, newVol);
      updateVolumeDisplay(id, newVol);
    });
  }

  // Make draggable
  const panel = document.getElementById(`sonos-${id}-controls`) as SVGElement | null;
  if (panel && typeof window.createDraggable === 'function') {
    const storageKey = `sonos${id}Position`;
    window.loadSavedPosition(panel, storageKey);
    window.createDraggable(panel, {
      storageKey: storageKey,
      excludeSelector: '.sonos-button',
    });
  }
}

/**
 * Update volume display for a speaker
 */
function updateVolumeDisplay(id: string, volume: number): void {
  const volumeEl = document.getElementById(`sonos-${id}-volume-label`);
  if (volumeEl) {
    volumeEl.textContent = `Vol: ${volume}`;
  }
}

/**
 * Get default position for speaker based on room
 */
function getDefaultPosition(id: string): { x: number; y: number } {
  const positions: Record<string, { x: number; y: number }> = {
    office: { x: 500, y: 280 },
    bedroom: { x: 180, y: 280 },
    lounge: { x: 400, y: 520 },
    'lounge-2': { x: 440, y: 480 },
    'lounge-3': { x: 360, y: 480 },
  };
  return positions[id] || { x: 300, y: 300 };
}

/**
 * Render all speaker controls
 */
async function renderSpeakerControls(): Promise<void> {
  const container = document.getElementById('sonos-controls-container');
  if (!container) {
    Logger.warn('Sonos controls container not found');
    return;
  }

  // Clear existing controls
  container.innerHTML = '';

  // Fetch current speakers
  await fetchSpeakers();
  const speakers = getSpeakers();

  if (Object.keys(speakers).length === 0) {
    Logger.info('No Sonos speakers found');
    return;
  }

  Logger.info(`Rendering ${Object.keys(speakers).length} Sonos speakers`);

  // Create control for each speaker
  for (const [id, speaker] of Object.entries(speakers)) {
    const control = createSpeakerControl(id, speaker);

    // Set initial position
    const pos = getDefaultPosition(id);
    control.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);

    container.appendChild(control);

    // Setup event handlers
    setupSpeakerControl(id, speaker);

    // Fetch initial volume
    try {
      const volume = await SonosAPI.getVolume(speaker.ip);
      setSpeakerVolume(id, volume);
      updateVolumeDisplay(id, volume);
    } catch (e) {
      Logger.warn(`Could not get volume for ${id}`);
    }
  }
}

/**
 * Update speaker volumes periodically
 */
async function updateSpeakerVolumes(): Promise<void> {
  const speakers = getSpeakers();
  for (const [id, speaker] of Object.entries(speakers)) {
    try {
      const volume = await SonosAPI.getVolume(speaker.ip);
      setSpeakerVolume(id, volume);
      updateVolumeDisplay(id, volume);
    } catch (e) {
      // Silently fail on volume update
    }
  }
}

/**
 * Initialize Sonos UI
 */
async function initSonosUI(): Promise<void> {
  // Check if proxy is available
  const available = await SonosAPI.checkAvailability();
  if (!available) {
    Logger.warn('Sonos proxy not available - speaker controls disabled');
    return;
  }

  // Render controls
  await renderSpeakerControls();

  // Register volume polling
  if (window.IntervalManager && APP_CONFIG?.intervals?.sonosVolume) {
    window.IntervalManager.register(updateSpeakerVolumes, APP_CONFIG.intervals.sonosVolume);
  }

  Logger.success('Sonos UI initialized');
}

/**
 * Sonos UI module export
 */
export const SonosUI = {
  init: initSonosUI,
  render: renderSpeakerControls,
  updateVolumes: updateSpeakerVolumes,
};

// Expose for other scripts
if (typeof window !== 'undefined') {
  window.SonosUI = SonosUI;
}

// Auto-initialize with consistent timing
function onReady(fn: () => void): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(fn, 50));
  } else {
    setTimeout(fn, 50);
  }
}

if (typeof window !== 'undefined') {
  onReady(initSonosUI);
}
