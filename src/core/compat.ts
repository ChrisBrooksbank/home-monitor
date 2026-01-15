/**
 * Backwards Compatibility Layer
 * Maintains window globals during migration transition
 *
 * This module creates window.* getters that delegate to the Registry,
 * allowing existing code to continue working while new code uses Registry directly.
 */

import { Registry, ServiceKey } from './registry';

/**
 * Expose a service on the window object via a getter
 * The getter delegates to Registry.getOptional() for lazy resolution
 */
function exposeOnWindow<K extends ServiceKey>(
  key: K,
  windowKey: string = key
): void {
  if (typeof window === 'undefined') return;

  // Skip if already defined (avoid overwriting direct assignments during migration)
  if (Object.getOwnPropertyDescriptor(window, windowKey)?.get) {
    return;
  }

  Object.defineProperty(window, windowKey, {
    get: () => Registry.getOptional(key),
    configurable: true,
    enumerable: true,
  });
}

/**
 * Initialize backwards compatibility for all services
 * Call this after all modules have registered with the Registry
 */
export function initCompat(): void {
  if (typeof window === 'undefined') return;

  // Core infrastructure
  exposeOnWindow('AppEvents');
  exposeOnWindow('AppState');
  exposeOnWindow('Poller');
  exposeOnWindow('ConnectionMonitor');
  exposeOnWindow('AppInitializer');

  // APIs
  exposeOnWindow('HueAPI');
  exposeOnWindow('SonosAPI');
  exposeOnWindow('TapoAPI');

  // Config
  exposeOnWindow('APP_CONFIG');
  exposeOnWindow('MAPPINGS');
  exposeOnWindow('CONFIG');

  // UI Utilities
  exposeOnWindow('IntervalManager');
  exposeOnWindow('createDraggable');
  exposeOnWindow('loadSavedPosition');

  // Features
  exposeOnWindow('SonosUI');
  exposeOnWindow('TapoControls');
  exposeOnWindow('ShieldUI');
  exposeOnWindow('NestIntegration');
  exposeOnWindow('LightEffects');
  exposeOnWindow('MooseSystem');
  exposeOnWindow('PlaneSystem');
  exposeOnWindow('MotionIndicators');
  exposeOnWindow('ColorPicker');
  exposeOnWindow('HomeMonitor');
  exposeOnWindow('LayersPanel');

  // Functions
  exposeOnWindow('toggleSection');
  exposeOnWindow('toggleViewMode');
  exposeOnWindow('setNestTemp');
  exposeOnWindow('redAlert');
  exposeOnWindow('partyMode');
  exposeOnWindow('discoMode');
  exposeOnWindow('waveEffect');
  exposeOnWindow('sunsetMode');
}

/**
 * Remove backwards compatibility (final cleanup after migration)
 * Call this when you're ready to remove all window globals
 */
export function removeCompat(): void {
  if (typeof window === 'undefined') return;

  const keys: string[] = [
    // Core
    'AppEvents',
    'AppState',
    'Poller',
    'ConnectionMonitor',
    'AppInitializer',
    // APIs
    'HueAPI',
    'SonosAPI',
    'TapoAPI',
    // Config
    'APP_CONFIG',
    'MAPPINGS',
    'CONFIG',
    // UI
    'IntervalManager',
    'createDraggable',
    'loadSavedPosition',
    // Features
    'SonosUI',
    'TapoControls',
    'ShieldUI',
    'NestIntegration',
    'LightEffects',
    'MooseSystem',
    'PlaneSystem',
    'MotionIndicators',
    'ColorPicker',
    'HomeMonitor',
    'LayersPanel',
    // Functions
    'toggleSection',
    'toggleViewMode',
    'setNestTemp',
    'redAlert',
    'partyMode',
    'discoMode',
    'waveEffect',
    'sunsetMode',
  ];

  for (const key of keys) {
    try {
      delete (window as unknown as Record<string, unknown>)[key];
    } catch {
      // Property may not be configurable
    }
  }
}
