/**
 * Light Effects Module
 * Fun light effects for Philips Hue lights (party, disco, wave, etc.)
 *
 * Uses HueAPI from src/api/hue.ts for all Hue Bridge communication.
 * Uses AppState for centralized state management.
 */

import { Logger } from '../utils/logger';
import { HueAPI } from '../api';
import { Registry } from '../core/registry';
import type { HueLightState, HueLightsResponse } from '../types';

// Helpers to get services from Registry
function getAppState() {
  return Registry.getOptional('AppState');
}
function getAppEvents() {
  return Registry.getOptional('AppEvents');
}

// =============================================================================
// STATE HELPERS (using centralized AppState)
// =============================================================================

const getEffectInProgress = (): boolean => (getAppState()?.get('effect.inProgress') as boolean) || false;
const setEffectInProgress = (value: boolean): void => {
  getAppState()?.set('effect.inProgress', value);
};
const getOriginalStates = (): Record<string, Partial<HueLightState>> =>
  (getAppState()?.get('effect.originalStates') as Record<string, Partial<HueLightState>>) || {};
const setOriginalStates = (states: Record<string, Partial<HueLightState>>): void => {
  getAppState()?.set('effect.originalStates', states);
};
const setCurrentEffect = (name: string | null): void => {
  getAppState()?.set('effect.currentEffect', name);
};

/**
 * Save current state of all lights
 */
async function saveLightStates(): Promise<boolean> {
  const lights = await HueAPI.getAllLights();
  if (!lights) return false;

  const states: Record<string, Partial<HueLightState>> = {};
  for (const [lightId, light] of Object.entries(lights)) {
    states[lightId] = {
      on: light.state.on,
      bri: light.state.bri,
      hue: light.state.hue,
      sat: light.state.sat,
    };
  }
  setOriginalStates(states);
  return true;
}

/**
 * Restore original light states
 */
async function restoreLightStates(onComplete?: () => void): Promise<void> {
  const originalStates = getOriginalStates();
  for (const [lightId, state] of Object.entries(originalStates)) {
    await HueAPI.setLightState(lightId, state);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // Keep effectInProgress true for a bit longer to suppress voice announcements
  // during the next polling cycle (lights poll every 10 seconds)
  setTimeout(() => {
    setEffectInProgress(false);
    setCurrentEffect(null);
    if (onComplete) onComplete();
  }, 12000);
}

/**
 * Disable/enable all effect buttons
 */
function disableEffectButtons(disable: boolean): void {
  const buttons = ['redAlertBtn', 'partyBtn', 'discoBtn', 'waveBtn', 'sunsetBtn'];
  buttons.forEach((btnId) => {
    const btn = document.getElementById(btnId) as HTMLButtonElement | null;
    if (btn) btn.disabled = disable;
  });
}

/**
 * Confirm effect with time-based warning
 */
function confirmEffect(effectName: string): boolean {
  const hour = new Date().getHours();
  const isNightTime = hour >= 22 || hour < 7;

  let message = `Run ${effectName} effect?\n\nThis will change all lights in your home.`;

  if (isNightTime) {
    message += `\n\nWARNING: It's currently ${hour}:00 - people may be sleeping!`;
  }

  return confirm(message);
}

/**
 * Check if effect is in progress
 */
export function isEffectInProgress(): boolean {
  return getEffectInProgress();
}

/**
 * Run a light effect with common boilerplate
 */
async function runLightEffect(
  effectName: string,
  effectCallback: (lights: HueLightsResponse) => Promise<void>,
  onComplete?: () => void
): Promise<void> {
  if (!confirmEffect(effectName)) return;
  if (getEffectInProgress()) return;

  setEffectInProgress(true);
  setCurrentEffect(effectName);
  disableEffectButtons(true);

  // Emit effect started event
  getAppEvents()?.emit('effect:started', { effect: effectName, timestamp: Date.now() });

  try {
    const success = await saveLightStates();
    if (!success) {
      setEffectInProgress(false);
      setCurrentEffect(null);
      disableEffectButtons(false);
      return;
    }

    const lights = await HueAPI.getAllLights();
    if (!lights) {
      setEffectInProgress(false);
      setCurrentEffect(null);
      disableEffectButtons(false);
      return;
    }

    await effectCallback(lights);
    await restoreLightStates(() => {
      // Emit effect completed event
      getAppEvents()?.emit('effect:completed', { effect: effectName, timestamp: Date.now() });
      if (onComplete) onComplete();
    });
  } finally {
    setEffectInProgress(false);
    setCurrentEffect(null);
    disableEffectButtons(false);
  }
}

/**
 * Red Alert - Flash all lights red
 */
export async function redAlert(onComplete?: () => void): Promise<void> {
  return runLightEffect(
    'Red Alert',
    async (lights) => {
      for (let i = 0; i < 6; i++) {
        for (const lightId of Object.keys(lights)) {
          await HueAPI.setLightState(lightId, {
            on: true,
            bri: 254,
            hue: 0,
            sat: 254,
            transitiontime: 0,
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 250));

        for (const lightId of Object.keys(lights)) {
          await HueAPI.setLightState(lightId, { on: false, transitiontime: 0 });
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    },
    onComplete
  );
}

/**
 * Party Mode - Cycle through rainbow colors
 */
export async function partyMode(onComplete?: () => void): Promise<void> {
  return runLightEffect(
    'Party Mode',
    async (lights) => {
      const colors = [0, 10922, 12750, 25500, 46920, 56100]; // Rainbow hues

      for (let cycle = 0; cycle < 12; cycle++) {
        const hue = colors[cycle % colors.length];

        for (const lightId of Object.keys(lights)) {
          await HueAPI.setLightState(lightId, {
            on: true,
            bri: 254,
            hue: hue,
            sat: 254,
            transitiontime: 5,
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    },
    onComplete
  );
}

/**
 * Disco Mode - Random flashing colors
 */
export async function discoMode(onComplete?: () => void): Promise<void> {
  return runLightEffect(
    'Disco',
    async (lights) => {
      const lightIds = Object.keys(lights);

      for (let i = 0; i < 20; i++) {
        for (const lightId of lightIds) {
          const randomHue = Math.floor(Math.random() * 65535);
          const randomOn = Math.random() > 0.3;

          await HueAPI.setLightState(lightId, {
            on: randomOn,
            bri: randomOn ? 254 : 0,
            hue: randomHue,
            sat: 254,
            transitiontime: 0,
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    },
    onComplete
  );
}

/**
 * Wave Effect - Lights turn on in sequence
 */
export async function waveEffect(onComplete?: () => void): Promise<void> {
  return runLightEffect(
    'Wave',
    async (lights) => {
      const lightIds = Object.keys(lights);

      // Turn all off first
      for (const lightId of lightIds) {
        await HueAPI.setLightState(lightId, { on: false, transitiontime: 0 });
      }
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Wave through 3 times
      for (let wave = 0; wave < 3; wave++) {
        for (const lightId of lightIds) {
          await HueAPI.setLightState(lightId, {
            on: true,
            bri: 254,
            hue: 46920,
            sat: 254,
            transitiontime: 0,
          });
          await new Promise((resolve) => setTimeout(resolve, 150));
          await HueAPI.setLightState(lightId, { on: false, transitiontime: 2 });
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    },
    onComplete
  );
}

/**
 * Sunset Mode - Gradual warm orange glow then fade
 */
export async function sunsetMode(onComplete?: () => void): Promise<void> {
  return runLightEffect(
    'Sunset',
    async (lights) => {
      // Fade to warm sunset orange
      for (const lightId of Object.keys(lights)) {
        await HueAPI.setLightState(lightId, {
          on: true,
          bri: 200,
          hue: 5000,
          sat: 200,
          transitiontime: 30,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 3500));
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Fade to dim
      for (const lightId of Object.keys(lights)) {
        await HueAPI.setLightState(lightId, {
          on: true,
          bri: 1,
          transitiontime: 30,
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 3500));
    },
    onComplete
  );
}

/**
 * Initialize effects and wire up jukebox buttons
 */
function initEffects(): void {
  // Initialize effect state in AppState
  setEffectInProgress(false);
  setCurrentEffect(null);
  setOriginalStates({});

  // Wire up jukebox buttons
  const buttonMap: Record<string, typeof redAlert> = {
    'jukebox-btn-1': redAlert, // Red Alert
    'jukebox-btn-2': partyMode, // Party
    'jukebox-btn-3': discoMode, // Disco
    'jukebox-btn-4': waveEffect, // Wave
    'jukebox-btn-5': sunsetMode, // Sunset
  };

  for (const [btnId, effectFn] of Object.entries(buttonMap)) {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        effectFn();
      });
    }
  }

  Logger.info('Light effects initialized');
}

/**
 * Light Effects module export
 */
export const LightEffects = {
  redAlert,
  partyMode,
  discoMode,
  waveEffect,
  sunsetMode,
  isEffectInProgress,
  init: initEffects,
};

// Register with the service registry
Registry.register({
  key: 'LightEffects',
  instance: LightEffects,
});

// Auto-initialize with consistent timing
function onReady(fn: () => void): void {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(fn, 50));
  } else {
    setTimeout(fn, 50);
  }
}

if (typeof window !== 'undefined') {
  onReady(initEffects);
}
