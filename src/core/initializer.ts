/**
 * Initializer Module
 * App bootstrap and feature registration
 */

import type { Feature, FeatureConfig } from '../types';
import { Logger } from '../utils/logger';
import { Registry } from './registry';

const VIEW_MODE_KEY = 'homeMonitorViewMode';

const features = new Map<string, Feature>();
const initOrder: string[] = [];

/**
 * Initialize view mode from localStorage
 */
function initViewMode(): void {
  const savedMode = localStorage.getItem(VIEW_MODE_KEY);
  if (savedMode === 'compact') {
    document.body.classList.add('compact-mode');
    updateViewModeLabel(true);
  } else {
    updateViewModeLabel(false);
  }
}

/**
 * Toggle between compact and full view modes
 */
function toggleViewMode(): void {
  const isCompact = document.body.classList.toggle('compact-mode');
  localStorage.setItem(VIEW_MODE_KEY, isCompact ? 'compact' : 'full');
  updateViewModeLabel(isCompact);
  Logger.info(`View mode: ${isCompact ? 'Simple' : 'Full'}`);
}

/**
 * Update the view mode toggle label
 */
function updateViewModeLabel(isCompact: boolean): void {
  const label = document.getElementById('viewModeLabel');
  const icon = document.querySelector('.view-toggle .toggle-icon');
  if (label) label.textContent = isCompact ? 'Simple' : 'Full';
  if (icon) icon.textContent = '\u{1F441}\uFE0F';
}

// Register toggleViewMode with the Registry
Registry.register({
  key: 'toggleViewMode',
  instance: toggleViewMode,
});

/**
 * Register a feature for initialization
 */
function registerFeature(name: string, config: FeatureConfig): void {
  const feature: Feature = {
    name,
    init: config.init,
    condition: config.condition ?? (() => true),
    dependencies: config.dependencies ?? [],
    priority: config.priority ?? 50,
    initialized: false,
  };
  features.set(name, feature);
  Logger.debug?.(`Initializer: Registered feature '${name}'`);
}

/**
 * Initialize a single feature
 */
async function initFeature(name: string): Promise<boolean> {
  const feature = features.get(name);
  if (!feature) {
    Logger.warn(`Initializer: Feature '${name}' not registered`);
    return false;
  }

  if (feature.initialized) {
    return true;
  }

  // Check dependencies
  if (feature.dependencies) {
    for (const dep of feature.dependencies) {
      if (!features.get(dep)?.initialized) {
        Logger.warn(`Initializer: Feature '${name}' waiting for dependency '${dep}'`);
        await initFeature(dep);
      }
    }
  }

  // Check condition
  if (feature.condition && !feature.condition()) {
    Logger.info(`Initializer: Feature '${name}' skipped (condition not met)`);
    return false;
  }

  try {
    await feature.init();
    feature.initialized = true;
    initOrder.push(name);
    Logger.success?.(`Initializer: Feature '${name}' initialized`) ??
      Logger.info(`Initializer: Feature '${name}' initialized`);
    return true;
  } catch (error) {
    Logger.error(`Initializer: Feature '${name}' failed:`, error);
    return false;
  }
}

/**
 * Load saved position for a draggable element
 */
function loadSavedPosition(element: SVGElement | HTMLElement | null, storageKey: string): void {
  if (!element) return;
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    try {
      const pos = JSON.parse(saved) as { x: number; y: number };
      if (
        element.tagName === 'g' ||
        element.namespaceURI === 'http://www.w3.org/2000/svg'
      ) {
        element.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
      } else {
        (element as HTMLElement).style.transform = `translate(${pos.x}px, ${pos.y}px)`;
      }
    } catch {
      // Invalid saved position, ignore
    }
  }
}

/**
 * Setup draggable functionality for UI elements
 */
function setupDraggables(): void {
  const createDraggable = Registry.getOptional('createDraggable');
  if (!createDraggable) {
    Logger.warn('Initializer: createDraggable not available');
    return;
  }

  // Weather panel
  const weatherPanel = document.getElementById('weather-info-panel');
  if (weatherPanel) {
    loadSavedPosition(weatherPanel, 'weatherPanelPosition');
    createDraggable(weatherPanel, { storageKey: 'weatherPanelPosition' });
  }

  // Jukebox (light effects)
  const jukebox = document.getElementById('jukebox');
  if (jukebox) {
    loadSavedPosition(jukebox, 'jukeboxPosition');
    createDraggable(jukebox, {
      storageKey: 'jukeboxPosition',
      excludeSelector: '.jukebox-button',
    });
  }
}

type ToggleLightFn = (lightId: string, currentState: boolean) => void;
type GetRoomLightsFn = (room: string) => Array<{ id: string; on: boolean }> | undefined;

/**
 * Setup lamppost click handler
 */
function setupLamppostHandler(
  toggleLight: ToggleLightFn,
  getRoomLights: GetRoomLightsFn
): void {
  const lampHousing = document.getElementById('lamp-housing');
  if (lampHousing) {
    lampHousing.style.cursor = 'pointer';
    lampHousing.addEventListener('dblclick', () => {
      const outdoorLights = getRoomLights('Outdoor');
      if (outdoorLights && outdoorLights.length > 0) {
        toggleLight(outdoorLights[0].id, outdoorLights[0].on);
      }
    });
  }
}

interface ConfigResult {
  isValid: boolean;
  hasFeature: (name: string) => boolean;
}

/**
 * Initialize and validate app configuration
 */
async function initConfiguration(): Promise<ConfigResult> {
  // Check for AppConfig via Registry or window (for backwards compat)
  const appConfig = Registry.getOptional('CONFIG') as { init?: () => Promise<ConfigResult> } | undefined;
  const windowAppConfig = typeof window !== 'undefined'
    ? (window as Window & { AppConfig?: { init: () => Promise<ConfigResult> } }).AppConfig
    : undefined;

  const configModule = appConfig ?? windowAppConfig;
  if (!configModule?.init) {
    Logger.warn('Initializer: AppConfig not available');
    return { isValid: true, hasFeature: () => true };
  }

  const config = await configModule.init();
  if (!config.isValid) {
    Logger.error('Configuration has errors - some features may not work');
  }

  // Log feature availability
  const featureList = ['hue', 'weather', 'nest', 'sonos', 'tapo', 'shield'];
  const available = featureList.filter((f) => config.hasFeature(f));
  const unavailable = featureList.filter((f) => !config.hasFeature(f));

  if (available.length > 0) {
    Logger.info(`Available features: ${available.join(', ')}`);
  }
  if (unavailable.length > 0) {
    Logger.warn(`Unavailable features: ${unavailable.join(', ')}`);
  }

  return config;
}

/**
 * Execute callback when DOM is ready
 */
function onReady(fn: () => void): void {
  const run = (): void => {
    try {
      fn();
    } catch (e) {
      Logger.error('Init error:', e);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
}

export const AppInitializer = {
  initViewMode,
  toggleViewMode,
  registerFeature,
  initFeature,
  getInitializedFeatures: (): string[] => [...initOrder],
  setupDraggables,
  setupLamppostHandler,
  loadSavedPosition,
  initConfiguration,
  onReady,
} as const;

// Register with the service registry
Registry.register({
  key: 'AppInitializer',
  instance: AppInitializer,
});

Registry.register({
  key: 'loadSavedPosition',
  instance: loadSavedPosition,
});
