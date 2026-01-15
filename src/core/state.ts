/**
 * Centralized State Store
 * Single source of truth for all application state
 */

import type {
  StateStore,
  RoomLights,
  MotionSensors,
  NestState,
  ConnectionsState,
  EffectState,
  AppStateData,
  TemperatureHistoryEntry,
  MotionHistoryEntry,
  SonosSpeaker,
  LightInfo,
} from '../types';
import { Logger } from '../utils/logger';
import { Registry } from './registry';

// Configuration
const CONFIG = {
  persistKeys: ['tempHistory', 'motionHistory', 'positions'] as const,
  maxHistorySize: 50,
  storagePrefix: 'appState_',
  enableHistory: true,
};

type PersistKey = (typeof CONFIG.persistKeys)[number];

// State history entry
interface StateHistoryEntry {
  key: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
}

// Initial state
const state: StateStore = {
  lights: {
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
  } as RoomLights,

  previousLightStates: {},

  motion: {
    Outdoor: { detected: false, lastUpdated: null },
    Hall: { detected: false, lastUpdated: null },
    Landing: { detected: false, lastUpdated: null },
    Bathroom: { detected: false, lastUpdated: null },
  } as MotionSensors,

  temperatures: {},
  tempHistory: {} as Record<string, TemperatureHistoryEntry[]>,
  motionHistory: [] as MotionHistoryEntry[],
  plugs: {} as Record<string, boolean>,
  speakers: {} as Record<string, SonosSpeaker>,
  speakerVolumes: {} as Record<string, number>,

  nest: {
    devices: [],
    currentTemp: null,
    targetTemp: null,
    mode: null,
  } as NestState,

  connections: {
    hue: { online: false, lastCheck: null, name: null, apiVersion: null },
    sonos: { online: false, lastCheck: null, uptime: null },
    tapo: { online: false, lastCheck: null, uptime: null },
    shield: { online: false, lastCheck: null, uptime: null },
  } as ConnectionsState,

  positions: {} as Record<string, { x: number; y: number }>,

  effect: {
    inProgress: false,
    currentEffect: null,
    originalStates: {},
  } as EffectState,

  app: {
    ready: false,
    viewMode: 'full',
    lastUpdate: null,
  } as AppStateData,
};

const stateHistory: StateHistoryEntry[] = [];

/**
 * Get a state value by key (supports dot notation)
 */
function get<T = unknown>(key: string): T | undefined {
  if (!key) return undefined;

  const keys = key.split('.');
  let value: unknown = state;

  for (const k of keys) {
    if (value === undefined || value === null) return undefined;
    value = (value as Record<string, unknown>)[k];
  }

  // Return a copy for objects/arrays to prevent mutation
  if (value && typeof value === 'object') {
    return (Array.isArray(value) ? [...value] : { ...value }) as T;
  }
  return value as T;
}

/**
 * Get all state
 */
function getAll(): StateStore {
  return JSON.parse(JSON.stringify(state)) as StateStore;
}

/**
 * Record a state change in history
 */
function recordHistory(key: string, oldValue: unknown, newValue: unknown): void {
  stateHistory.push({
    key,
    oldValue,
    newValue,
    timestamp: Date.now(),
  });

  if (stateHistory.length > CONFIG.maxHistorySize) {
    stateHistory.shift();
  }
}

/**
 * Persist a state key to localStorage
 */
function persist(key: string): void {
  try {
    const value = (state as Record<string, unknown>)[key];
    if (value !== undefined) {
      localStorage.setItem(CONFIG.storagePrefix + key, JSON.stringify(value));
    }
  } catch (error) {
    Logger.error(`Failed to persist state key '${key}':`, error);
  }
}

interface SetOptions {
  silent?: boolean;
  persist?: boolean;
}

/**
 * Set a state value
 */
function set<T>(key: string, value: T, options: SetOptions = {}): void {
  const oldValue = get(key);
  const keys = key.split('.');
  let target: Record<string, unknown> = state;

  // Navigate to parent
  for (let i = 0; i < keys.length - 1; i++) {
    if (target[keys[i]] === undefined) {
      target[keys[i]] = {};
    }
    target = target[keys[i]] as Record<string, unknown>;
  }

  // Set the value
  const finalKey = keys[keys.length - 1];
  target[finalKey] = value;

  // Record history
  if (CONFIG.enableHistory) {
    recordHistory(key, oldValue, value);
  }

  // Persist if needed
  const shouldPersist =
    options.persist ?? CONFIG.persistKeys.includes(keys[0] as PersistKey);
  if (shouldPersist) {
    persist(keys[0]);
  }

  // Emit event
  const events = Registry.getOptional('AppEvents');
  if (!options.silent && events) {
    events.emit(`state:${key}:changed`, {
      key,
      value,
      oldValue,
      timestamp: Date.now(),
    });

    // Also emit top-level key event for convenience
    if (keys.length > 1) {
      events.emit(`state:${keys[0]}:changed`, {
        key: keys[0],
        value: (state as Record<string, unknown>)[keys[0]],
        subKey: key,
        timestamp: Date.now(),
      });
    }
  }
}

/**
 * Update state by merging with existing value
 */
function update<T extends object>(
  key: string,
  updates: Partial<T>,
  options: SetOptions = {}
): void {
  const current = get<T>(key) ?? ({} as T);
  if (typeof current !== 'object' || Array.isArray(current)) {
    set(key, updates, options);
    return;
  }
  set(key, { ...current, ...updates }, options);
}

interface PushOptions extends SetOptions {
  maxLength?: number;
}

/**
 * Push a value to an array state
 */
function push<T>(key: string, value: T, options: PushOptions = {}): void {
  const current = get<T[]>(key);
  if (!Array.isArray(current)) {
    set(key, [value], options);
    return;
  }

  const newArray = [...current, value];
  if (options.maxLength && newArray.length > options.maxLength) {
    newArray.shift();
  }
  set(key, newArray, options);
}

/**
 * Remove a value from state
 */
function remove(key: string): void {
  const keys = key.split('.');
  let target: Record<string, unknown> = state;

  for (let i = 0; i < keys.length - 1; i++) {
    if (target[keys[i]] === undefined) return;
    target = target[keys[i]] as Record<string, unknown>;
  }

  const finalKey = keys[keys.length - 1];
  const oldValue = target[finalKey];
  delete target[finalKey];

  const events = Registry.getOptional('AppEvents');
  if (events) {
    events.emit(`state:${key}:removed`, {
      key,
      oldValue,
      timestamp: Date.now(),
    });
  }
}

/**
 * Load persisted state from localStorage
 */
function loadPersisted(): void {
  for (const key of CONFIG.persistKeys) {
    try {
      const stored = localStorage.getItem(CONFIG.storagePrefix + key);
      if (stored) {
        (state as Record<string, unknown>)[key] = JSON.parse(stored);
        Logger.debug(`Loaded persisted state: ${key}`);
      }
    } catch (error) {
      Logger.error(`Failed to load persisted state '${key}':`, error);
    }
  }

  // Load legacy keys for backwards compatibility
  loadLegacyState();
}

/**
 * Load state from legacy localStorage keys
 */
function loadLegacyState(): void {
  const legacyMappings: Record<string, keyof StateStore> = {
    tempHistory: 'tempHistory',
    motionHistory: 'motionHistory',
  };

  for (const [legacyKey, stateKey] of Object.entries(legacyMappings)) {
    try {
      const stored = localStorage.getItem(legacyKey);
      if (stored && !(state as Record<string, unknown>)[stateKey]) {
        (state as Record<string, unknown>)[stateKey] = JSON.parse(stored);
        Logger.debug(`Migrated legacy state: ${legacyKey} -> ${stateKey}`);
      }
    } catch {
      // Ignore legacy load errors
    }
  }
}

/**
 * Clear all persisted state
 */
function clearPersisted(): void {
  for (const key of CONFIG.persistKeys) {
    localStorage.removeItem(CONFIG.storagePrefix + key);
  }
  Logger.info('Cleared all persisted state');
}

/**
 * Get state change history
 */
function getHistory(limit = 10, filter?: string): StateHistoryEntry[] {
  let history = [...stateHistory];
  if (filter) {
    history = history.filter((h) => h.key.startsWith(filter));
  }
  return history.slice(-limit);
}

// Selectors
type SelectorResult<T> = T;

const selectors = {
  lightsOn: (): LightInfo[] => {
    const result: (LightInfo & { room: string })[] = [];
    for (const [room, lights] of Object.entries(state.lights)) {
      for (const light of lights) {
        if (light.on) {
          result.push({ ...light, room });
        }
      }
    }
    return result;
  },

  activeMotion: (): Array<{ room: string; detected: boolean; lastUpdated: Date | null }> => {
    const result: Array<{ room: string; detected: boolean; lastUpdated: Date | null }> = [];
    for (const [room, motion] of Object.entries(state.motion)) {
      if (motion.detected) {
        result.push({ room, ...motion });
      }
    }
    return result;
  },

  onlineConnections: (): string[] => {
    const result: string[] = [];
    for (const [name, status] of Object.entries(state.connections)) {
      if (status.online) {
        result.push(name);
      }
    }
    return result;
  },

  plugsOn: (): string[] => {
    const result: string[] = [];
    for (const [name, isOn] of Object.entries(state.plugs)) {
      if (isOn) {
        result.push(name);
      }
    }
    return result;
  },

  avgIndoorTemp: (): number | null => {
    const indoorRooms = [
      'Main Bedroom',
      'Guest Bedroom',
      'Landing',
      'Home Office',
      'Bathroom',
      'Lounge',
      'Hall',
      'Extension',
      'Kitchen',
    ];
    const temps: number[] = [];
    for (const [room, temp] of Object.entries(state.temperatures)) {
      if (indoorRooms.includes(room) && temp !== null) {
        temps.push(temp);
      }
    }
    if (temps.length === 0) return null;
    return temps.reduce((a, b) => a + b, 0) / temps.length;
  },

  recentMotion: (): MotionHistoryEntry[] => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return state.motionHistory.filter((e) => e.time > cutoff);
  },
};

type SelectorName = keyof typeof selectors;

/**
 * Run a selector
 */
function select<T>(name: SelectorName): SelectorResult<T> | undefined {
  const selector = selectors[name];
  if (!selector) {
    Logger.warn(`Unknown selector: ${name}`);
    return undefined;
  }
  return selector() as SelectorResult<T>;
}

/**
 * Register a custom selector
 */
function registerSelector(name: string, fn: () => unknown): void {
  if (typeof fn !== 'function') {
    Logger.error('Selector must be a function');
    return;
  }
  (selectors as Record<string, () => unknown>)[name] = fn;
}

/**
 * Set multiple state values at once
 */
function setMany(updates: Record<string, unknown>, options: SetOptions = {}): void {
  const silent = options.silent;
  options.silent = true; // Suppress individual events

  for (const [key, value] of Object.entries(updates)) {
    set(key, value, options);
  }

  // Emit single batch event
  const events = Registry.getOptional('AppEvents');
  if (!silent && events) {
    events.emit('state:batch:changed', {
      keys: Object.keys(updates),
      timestamp: Date.now(),
    });
  }
}

/**
 * Reset state to initial values
 */
function reset(key?: string): void {
  if (key) {
    const current = (state as Record<string, unknown>)[key];
    if (Array.isArray(current)) {
      set(key, []);
    } else if (typeof current === 'object' && current !== null) {
      set(key, {});
    } else {
      set(key, null);
    }
  } else {
    Logger.warn('Full state reset requested - this is destructive');
  }
}

/**
 * Initialize the state store
 */
function init(): void {
  loadPersisted();
  Logger.info('AppState initialized');

  // Subscribe to relevant events to auto-update state
  const events = Registry.getOptional('AppEvents');
  if (events) {
    events.on('connection:hue:online', (data: { name: string }) => {
      update('connections.hue', { online: true, name: data.name }, { silent: true });
    });
    events.on('connection:hue:offline', () => {
      update('connections.hue', { online: false }, { silent: true });
    });
    events.on('connection:proxy:online', (data: { proxy: string }) => {
      set(`connections.${data.proxy}.online`, true, { silent: true });
    });
    events.on('connection:proxy:offline', (data: { proxy: string }) => {
      set(`connections.${data.proxy}.online`, false, { silent: true });
    });

    events.on('app:ready', () => {
      set('app.ready', true, { silent: true });
      set('app.lastUpdate', Date.now(), { silent: true });
    });
  }
}

export const AppState = {
  get,
  getAll,
  set,
  update,
  push,
  remove,
  persist,
  loadPersisted,
  clearPersisted,
  select,
  registerSelector,
  setMany,
  reset,
  getHistory,
  init,
} as const;

// Register with the service registry
Registry.register({
  key: 'AppState',
  instance: AppState,
});

// Auto-initialize when DOM is ready (browser only)
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
