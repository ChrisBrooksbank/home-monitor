/**
 * Service Registry - Type-safe dependency injection
 * Replaces window globals with explicit service registration
 */

import type {
  AppConfig,
  HueConfig,
  WeatherConfig,
  NestConfig,
} from '../types';

// =============================================================================
// SERVICE KEY TYPE
// =============================================================================

/**
 * All registered service keys
 */
export type ServiceKey =
  // Core infrastructure
  | 'AppEvents'
  | 'AppState'
  | 'Poller'
  | 'ConnectionMonitor'
  | 'AppInitializer'
  // APIs
  | 'HueAPI'
  | 'SonosAPI'
  | 'TapoAPI'
  // Features
  | 'SonosUI'
  | 'TapoControls'
  | 'ShieldUI'
  | 'NestIntegration'
  | 'LightEffects'
  | 'MooseSystem'
  | 'PlaneSystem'
  | 'MotionIndicators'
  | 'ColorPicker'
  | 'HomeMonitor'
  | 'Lights'
  // Config
  | 'APP_CONFIG'
  | 'HUE_CONFIG'
  | 'WEATHER_CONFIG'
  | 'NEST_CONFIG'
  | 'MAPPINGS'
  | 'CONFIG'
  // UI Utilities
  | 'IntervalManager'
  | 'createDraggable'
  | 'loadSavedPosition'
  | 'LayersPanel'
  // Functions
  | 'toggleViewMode'
  | 'setNestTemp'
  | 'redAlert'
  | 'partyMode'
  | 'discoMode'
  | 'waveEffect'
  | 'sunsetMode';

// =============================================================================
// SERVICE MAP TYPE
// =============================================================================

/**
 * Maps service keys to their types
 * Uses dynamic imports to avoid circular dependencies
 */
export interface ServiceMap {
  // Core infrastructure
  AppEvents: typeof import('./events').AppEvents;
  AppState: typeof import('./state').AppState;
  Poller: typeof import('./poller').Poller;
  ConnectionMonitor: typeof import('./connection-monitor').ConnectionMonitor;
  AppInitializer: typeof import('./initializer').AppInitializer;

  // APIs
  HueAPI: typeof import('../api/hue').HueAPI;
  SonosAPI: typeof import('../api/sonos').SonosAPI;
  TapoAPI: typeof import('../api/tapo').TapoAPI;

  // Features (use unknown for complex feature types to avoid circular deps)
  SonosUI: { init: () => Promise<void> };
  TapoControls: { init: () => Promise<void> };
  ShieldUI: { init: () => Promise<void> };
  NestIntegration: unknown;
  LightEffects: unknown;
  MooseSystem: unknown;
  PlaneSystem: unknown;
  MotionIndicators: unknown;
  ColorPicker: unknown;
  HomeMonitor: { loadLights: () => void };
  Lights: { loadLights: () => Promise<void>; updateLightIndicators: () => void };

  // Config
  APP_CONFIG: AppConfig;
  HUE_CONFIG: HueConfig;
  WEATHER_CONFIG: WeatherConfig & { LOCATION?: string };
  NEST_CONFIG: NestConfig & {
    refresh_token?: string;
    access_token?: string;
    expires_at?: number;
    REFRESH_TOKEN?: string;
    ACCESS_TOKEN?: string;
    EXPIRES_AT?: number;
  };
  MAPPINGS: typeof import('../config/mappings').MAPPINGS;
  CONFIG: unknown;

  // UI Utilities
  IntervalManager: typeof import('../utils/helpers').IntervalManager;
  createDraggable: typeof import('../ui/draggable').createDraggable;
  loadSavedPosition: typeof import('../ui/draggable').loadSavedPosition;
  LayersPanel: { getLayerState: (layer: string) => boolean };

  // Functions
  toggleViewMode: () => void;
  setNestTemp: (temp: number) => Promise<boolean>;
  redAlert: () => Promise<void>;
  partyMode: () => Promise<void>;
  discoMode: () => Promise<void>;
  waveEffect: () => Promise<void>;
  sunsetMode: () => Promise<void>;
}

// =============================================================================
// INTERNAL TYPES
// =============================================================================

/**
 * Factory function for lazy initialization
 */
type ServiceFactory<K extends ServiceKey> = () => ServiceMap[K] | Promise<ServiceMap[K]>;

/**
 * Registration options
 */
interface RegistrationOptions<K extends ServiceKey> {
  key: K;
  instance?: ServiceMap[K];
  factory?: ServiceFactory<K>;
}

/**
 * Internal registry entry
 */
interface RegistryEntry {
  instance?: unknown;
  factory?: () => unknown | Promise<unknown>;
  resolved: boolean;
}

// =============================================================================
// REGISTRY IMPLEMENTATION
// =============================================================================

const registry = new Map<ServiceKey, RegistryEntry>();
const resolutionStack: ServiceKey[] = [];

/**
 * Register a service with the registry
 */
function register<K extends ServiceKey>(options: RegistrationOptions<K>): void {
  const { key, instance, factory } = options;

  if (registry.has(key) && registry.get(key)?.resolved) {
    // Already registered and resolved - skip silently for re-imports
    return;
  }

  registry.set(key, {
    instance,
    factory: factory as (() => unknown) | undefined,
    resolved: instance !== undefined,
  });
}

/**
 * Get a service from the registry (throws if not found)
 */
function get<K extends ServiceKey>(key: K): ServiceMap[K] {
  const entry = registry.get(key);

  if (!entry) {
    throw new Error(`Registry: Service '${key}' not registered`);
  }

  // Return cached instance
  if (entry.resolved && entry.instance !== undefined) {
    return entry.instance as ServiceMap[K];
  }

  // Circular dependency check
  if (resolutionStack.includes(key)) {
    throw new Error(
      `Registry: Circular dependency detected: ${resolutionStack.join(' -> ')} -> ${key}`
    );
  }

  // Resolve via factory
  if (entry.factory) {
    resolutionStack.push(key);
    try {
      const result = entry.factory();
      if (result instanceof Promise) {
        throw new Error(
          `Registry: Service '${key}' has async factory - use getAsync() instead`
        );
      }
      entry.instance = result;
      entry.resolved = true;
    } finally {
      resolutionStack.pop();
    }
  }

  if (entry.instance === undefined) {
    throw new Error(`Registry: Service '${key}' has no instance or factory`);
  }

  return entry.instance as ServiceMap[K];
}

/**
 * Get a service asynchronously (for async factories)
 */
async function getAsync<K extends ServiceKey>(key: K): Promise<ServiceMap[K]> {
  const entry = registry.get(key);

  if (!entry) {
    throw new Error(`Registry: Service '${key}' not registered`);
  }

  if (entry.resolved && entry.instance !== undefined) {
    return entry.instance as ServiceMap[K];
  }

  if (entry.factory) {
    const result = await entry.factory();
    entry.instance = result;
    entry.resolved = true;
  }

  if (entry.instance === undefined) {
    throw new Error(`Registry: Service '${key}' has no instance or factory`);
  }

  return entry.instance as ServiceMap[K];
}

/**
 * Get a service optionally (returns undefined if not found)
 */
function getOptional<K extends ServiceKey>(key: K): ServiceMap[K] | undefined {
  if (!registry.has(key)) {
    return undefined;
  }

  try {
    return get(key);
  } catch {
    return undefined;
  }
}

/**
 * Check if a service is registered
 */
function has(key: ServiceKey): boolean {
  return registry.has(key);
}

/**
 * Check if a service is resolved (instance available)
 */
function isResolved(key: ServiceKey): boolean {
  const entry = registry.get(key);
  return entry?.resolved ?? false;
}

/**
 * Replace a service (primarily for testing)
 */
function replace<K extends ServiceKey>(key: K, instance: ServiceMap[K]): void {
  registry.set(key, {
    instance,
    resolved: true,
  });
}

/**
 * Clear all registered services (for testing)
 */
function clear(): void {
  registry.clear();
  resolutionStack.length = 0;
}

/**
 * Get all registered service keys (for debugging)
 */
function keys(): ServiceKey[] {
  return Array.from(registry.keys());
}

// =============================================================================
// EXPORTS
// =============================================================================

export const Registry = {
  register,
  get,
  getAsync,
  getOptional,
  has,
  isResolved,
  replace,
  clear,
  keys,
} as const;

// Export type for external use
export type { RegistrationOptions };
