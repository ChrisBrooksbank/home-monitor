/**
 * Outdoor Lamppost Module
 * Handles the outdoor lamppost UI element
 */

import type { RoomLights } from '../../types';
import { AppState } from '../../core/state';
import { createDraggable, loadSavedPosition } from '../../ui/draggable';

/**
 * Get room lights from AppState (local helper to avoid circular import)
 */
function getRoomLights(): RoomLights {
  return (
    AppState.get<RoomLights>('lights') ?? {
      'Main Bedroom': [],
      'Guest Bedroom': [],
      Landing: [],
      'Home Office': [],
      Bathroom: [],
      Lounge: [],
      Hall: [],
      Extension: [],
      Kitchen: [],
      Outdoor: [],
    }
  );
}

/**
 * Update the outdoor lamppost appearance based on outdoor light state
 */
export function updateOutdoorLamppost(): void {
  const roomLights = getRoomLights();
  const outdoorLights = roomLights['Outdoor'] || [];
  const outdoorLightsOn = outdoorLights.some((l) => l.on);

  const bulb = document.getElementById('lamp-bulb');
  const glow = document.getElementById('lamp-glow');
  const housing = document.getElementById('lamp-housing');

  if (!bulb) return;

  if (outdoorLightsOn) {
    // Bulb on - warm glow
    bulb.setAttribute('fill', '#FFD700');
    bulb.setAttribute('filter', 'url(#glow)');

    // Glass panels glow warm
    if (housing) {
      const panels = housing.querySelector('rect[opacity]');
      if (panels) {
        panels.setAttribute('fill', '#FFE4B5');
        panels.setAttribute('opacity', '0.7');
      }
    }

    // Outer glow visible
    if (glow) {
      const animate = glow.querySelector('animate');
      if (animate) animate.setAttribute('values', '0.3;0.5;0.3');
    }
  } else {
    // Bulb off
    bulb.setAttribute('fill', '#666');
    bulb.removeAttribute('filter');

    // Glass panels dark
    if (housing) {
      const panels = housing.querySelector('rect[opacity]');
      if (panels) {
        panels.setAttribute('fill', '#1E3A3A');
        panels.setAttribute('opacity', '0.4');
      }
    }

    // No outer glow
    if (glow) {
      const animate = glow.querySelector('animate');
      if (animate) animate.setAttribute('values', '0;0');
    }
  }
}

/**
 * Initialize lamppost draggable behavior
 */
export function initLamppostDraggable(): void {
  const lamppost = document.getElementById('outdoor-lamppost');
  if (lamppost) {
    const storageKey = 'lamppost-position';
    loadSavedPosition(lamppost, storageKey);
    createDraggable(lamppost, { storageKey: storageKey });
  }
}

/**
 * Lamppost module export
 */
export const Lamppost = {
  updateOutdoorLamppost,
  initLamppostDraggable,
};

// Expose on window for backwards compatibility
if (typeof window !== 'undefined') {
  (window as Window & { Lamppost?: typeof Lamppost }).Lamppost = Lamppost;
}
