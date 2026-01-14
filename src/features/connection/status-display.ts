/**
 * Connection Status Display
 * Wheelie bin LED status indicators and popup display
 */

import { AppEvents } from '../../core/events';
import { ConnectionMonitor } from '../../core/connection-monitor';
import { createDraggable, loadSavedPosition } from '../../ui/draggable';

// Module state
let binPopupVisible = false;

/**
 * Initialize wheelie bin draggable behavior
 */
export function initWheelieBinDraggable(): void {
  const bin = document.getElementById('wheelie-bin');
  if (bin) {
    const storageKey = 'wheelie-bin-position';
    loadSavedPosition(bin, storageKey);
    createDraggable(bin, { storageKey: storageKey });
  }
}

/**
 * Update a bin LED color based on online status
 */
export function updateBinLed(service: string, online: boolean): void {
  const led = document.getElementById(`bin-led-${service}`);
  if (led) {
    led.setAttribute('fill', online ? '#4CAF50' : '#F44336');
  }

  // Also update popup indicator if it exists
  const popupGroup = document.getElementById(`popup-status-${service}`);
  if (popupGroup) {
    const circle = popupGroup.querySelector('circle');
    if (circle) {
      circle.setAttribute('fill', online ? '#4CAF50' : '#F44336');
    }
    const statusText = document.getElementById(`popup-status-${service}-text`);
    if (statusText) {
      statusText.textContent = online ? 'Online' : 'Offline';
      statusText.setAttribute('fill', online ? '#4CAF50' : '#F44336');
    }
  }
}

/**
 * Toggle the proxy status popup visibility
 */
export function toggleBinPopup(): void {
  const popup = document.getElementById('proxy-status-popup');
  const bin = document.getElementById('wheelie-bin');
  if (!popup || !bin) return;

  binPopupVisible = !binPopupVisible;

  if (binPopupVisible) {
    // Position popup near the bin
    const binTransform = bin.getAttribute('transform') || '';
    const match = binTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);
    const binX = match ? parseFloat(match[1]) : 920;
    const binY = match ? parseFloat(match[2]) : 555;

    popup.setAttribute('transform', `translate(${binX - 140}, ${binY - 100})`);
    popup.style.display = 'block';
  } else {
    popup.style.display = 'none';
  }
}

/**
 * Initialize wheelie bin click handler and status subscriptions
 */
export function initBinStatusDisplay(): void {
  const bin = document.getElementById('wheelie-bin');
  if (!bin) return;

  // Click handler for popup toggle
  bin.addEventListener('click', (e) => {
    // Don't toggle if we just finished dragging
    if (e.defaultPrevented) return;
    toggleBinPopup();
  });

  // Close popup when clicking elsewhere
  document.addEventListener('click', (e) => {
    if (!binPopupVisible) return;
    const popup = document.getElementById('proxy-status-popup');
    const target = e.target as Element;
    if (!bin.contains(target) && popup && !popup.contains(target)) {
      binPopupVisible = false;
      popup.style.display = 'none';
    }
  });

  // Subscribe to connection events
  AppEvents.on('connection:hue:online', () => updateBinLed('hue', true));
  AppEvents.on('connection:hue:offline', () => updateBinLed('hue', false));
  AppEvents.on('connection:proxy:online', (data: { proxy: string }) => {
    updateBinLed(data.proxy, true);
  });
  AppEvents.on('connection:proxy:offline', (data: { proxy: string }) => {
    updateBinLed(data.proxy, false);
  });

  // Set initial states from ConnectionMonitor
  updateBinLed('hue', ConnectionMonitor.isOnline('hue'));
  updateBinLed('sonos', ConnectionMonitor.isOnline('sonos'));
  updateBinLed('tapo', ConnectionMonitor.isOnline('tapo'));
  updateBinLed('shield', ConnectionMonitor.isOnline('shield'));
}

/**
 * Connection status display module export
 */
export const ConnectionStatusDisplay = {
  initWheelieBinDraggable,
  updateBinLed,
  toggleBinPopup,
  initBinStatusDisplay,
};

// Expose on window for backwards compatibility
if (typeof window !== 'undefined') {
  (
    window as Window & { ConnectionStatusDisplay?: typeof ConnectionStatusDisplay }
  ).ConnectionStatusDisplay = ConnectionStatusDisplay;
}
