/**
 * Home Monitor Application - Orchestration Layer
 *
 * This module orchestrates the application by:
 * - Wiring event subscriptions (voice announcements, logging)
 * - Initializing feature modules on startup
 * - Registering polling tasks
 * - Exposing the public HomeMonitor API
 *
 * Feature modules in src/features/:
 * - temperature/ - Sensor data and thermometer UI
 * - motion/ - Motion sensors and history log
 * - lights/ - Light state and indicator UI
 * - voice/ - Voice announcements
 * - connection/ - Connection status display
 * - sky, weather - External data display
 *
 * Core infrastructure in src/core/:
 * - connection-monitor.ts - Health checks
 * - poller.ts - Polling scheduler
 * - initializer.ts - App bootstrap
 * - events.ts - Event bus
 * - state.ts - Centralized state
 */

import type {
  RoomName,
  RoomLights,
  LightInfo,
  MotionDetectedEvent,
  LightChangedEvent,
  ConnectionHueOnlineEvent,
  ConnectionProxyEvent,
  EventMeta,
} from './types';
import { Logger } from './utils/logger';
import { APP_CONFIG } from './config/constants';
import { AppEvents } from './core/events';
import { Poller } from './core/poller';
import { ConnectionMonitor } from './core/connection-monitor';
import { AppInitializer } from './core/initializer';
import { announceMotion, announceLight } from './features/voice';
import { initWheelieBinDraggable, initBinStatusDisplay } from './features/connection';
import {
  loadLights,
  initLamppostDraggable,
  toggleLight,
  getRoomLights,
  LightInfoExtended,
} from './features/lights';
import {
  loadMotionSensors,
  initMotionHistory,
  updateMotionLogDisplay,
  getMotionSensors,
} from './features/motion';
import { loadTemperatures, initTempHistory } from './features/temperature';
import { fetchSunTimes, updateSky } from './features/sky';
import { updateWeatherDisplay } from './features/weather';

// =============================================================================
// WINDOW DECLARATIONS
// =============================================================================

declare const window: Window & {
  WEATHER_CONFIG?: { API_KEY: string; LOCATION?: string };
  TapoControls?: { init: () => Promise<void> };
  ColorPicker?: { handleBulbClick: (id: string, light: LightInfoExtended, e: MouseEvent) => void };
  HomeMonitor?: typeof HomeMonitor;
  toggleSection?: typeof toggleSection;
};

// =============================================================================
// EVENT SUBSCRIPTIONS
// =============================================================================

/**
 * Setup event subscriptions to decouple data loading from side effects
 * This allows features to react to events without direct coupling
 *
 * Note: MotionIndicators now subscribes to motion:detected internally,
 * so we only handle voice announcements here.
 */
function setupEventSubscriptions(): void {
  // Motion detection -> voice announcement
  // (MotionIndicators handles its own subscription for visual indicators)
  AppEvents.on<MotionDetectedEvent>('motion:detected', (data) => {
    announceMotion(data.room);
  });

  // Light state change -> voice announcement
  AppEvents.on<LightChangedEvent>('light:changed', (data) => {
    announceLight(data.room, data.on);
  });

  // Connection status changes -> logging
  AppEvents.on<ConnectionHueOnlineEvent>('connection:hue:online', (data) => {
    Logger.success(`Hue Bridge connected: ${data.name}`);
  });

  AppEvents.on('connection:hue:offline', () => {
    Logger.warn('Hue Bridge disconnected');
  });

  AppEvents.on<ConnectionProxyEvent>('connection:proxy:online', (data) => {
    Logger.success(`${data.proxy} proxy connected`);
  });

  AppEvents.on<ConnectionProxyEvent>('connection:proxy:offline', (data) => {
    Logger.warn(`${data.proxy} proxy disconnected`);
  });

  // Debug: log all events in debug mode
  if (APP_CONFIG.debug) {
    AppEvents.on('*', (data: unknown, meta: EventMeta) => {
      Logger.debug(`Event: ${meta.event}`, data);
    });
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

async function init(): Promise<void> {
  Logger.info('Initializing Home Monitor...');

  // Setup event subscriptions (decouple data loading from side effects)
  setupEventSubscriptions();

  // Initialize configuration
  await AppInitializer.initConfiguration();

  // Initialize history
  initTempHistory();
  initMotionHistory();

  // Load Hue data immediately (direct connection, no proxy needed)
  Logger.info('Loading Hue data...');
  const hueDataPromise = Promise.all([loadTemperatures(), loadLights(), loadMotionSensors()]);

  // Check proxy connections in parallel (faster startup)
  const proxyCheckPromise = ConnectionMonitor.waitForConnections({
    maxAttempts: 3,
    retryInterval: 500,
    timeout: 5000,
  });

  // Wait for Hue data (critical) - proxies can finish in background
  await hueDataPromise;

  // Initialize Tapo once proxy check completes
  proxyCheckPromise.then(async () => {
    if (typeof window.TapoControls !== 'undefined' && window.TapoControls?.init) {
      if (ConnectionMonitor.isOnline('tapo')) {
        Logger.info('Initializing Tapo controls...');
        await window.TapoControls.init();
      } else {
        Logger.warn('Tapo proxy offline, skipping Tapo initialization');
      }
    }
  });

  // Fetch external data
  fetchSunTimes();
  updateWeatherDisplay();

  // Setup UI handlers
  AppInitializer.setupDraggables();
  AppInitializer.setupLamppostHandler(toggleLight, (room: string) => {
    const lights = getRoomLights();
    return lights[room as RoomName];
  });
  initLamppostDraggable();
  initWheelieBinDraggable();
  initBinStatusDisplay();

  // Register polling tasks using the Poller module
  Poller.register(
    'connectionStatus',
    async () => { await ConnectionMonitor.checkAll(); },
    APP_CONFIG.intervals.connectionStatus || 30000
  );
  Poller.register('motionSensors', loadMotionSensors, APP_CONFIG.intervals.motionSensors);
  Poller.register('lights', loadLights, APP_CONFIG.intervals.lights);
  Poller.register('temperatures', () => loadTemperatures(false), APP_CONFIG.intervals.temperatures);
  Poller.register('motionLog', updateMotionLogDisplay, APP_CONFIG.intervals.motionLog);
  Poller.register('sky', updateSky, APP_CONFIG.intervals.sky);
  Poller.register('sunTimes', async () => { await fetchSunTimes(); }, APP_CONFIG.intervals.sunTimes);
  Poller.register('weather', async () => { await updateWeatherDisplay(); }, APP_CONFIG.intervals.weather);

  // Start all polling
  Poller.startAll();

  Logger.success('Home Monitor initialized!');

  // Emit app ready event
  // Note: MooseSystem subscribes to this event and auto-initializes
  AppEvents.emit('app:ready', {
    timestamp: Date.now(),
    features: {
      hue: ConnectionMonitor.isOnline('hue'),
      sonos: ConnectionMonitor.isOnline('sonos'),
      tapo: ConnectionMonitor.isOnline('tapo'),
      shield: ConnectionMonitor.isOnline('shield'),
    },
  });
}

// =============================================================================
// COLLAPSIBLE SECTIONS
// =============================================================================

/**
 * Toggle a collapsible section (Sensor Details, Activity Log, etc.)
 * @param contentId - ID of the content element to toggle
 * @param arrowId - ID of the arrow indicator element
 */
function toggleSection(contentId: string, arrowId: string): void {
  const content = document.getElementById(contentId);
  const arrow = document.getElementById(arrowId);

  if (content && arrow) {
    content.classList.toggle('collapsed');
    arrow.classList.toggle('collapsed');
  }
}

// Expose toggleSection globally for onclick handlers
if (typeof window !== 'undefined') {
  window.toggleSection = toggleSection;
}

// =============================================================================
// EXPOSE MODULE
// =============================================================================

export const HomeMonitor = {
  init,
  loadTemperatures,
  loadLights,
  loadMotionSensors,
  updateWeatherDisplay,
  toggleLight,
  getRoomLights: (room?: string): RoomLights | LightInfo[] | undefined => {
    const lights = getRoomLights();
    return room ? lights[room as RoomName] : lights;
  },
  getMotionSensors,
} as const;

// Expose on window for global access
if (typeof window !== 'undefined') {
  window.HomeMonitor = HomeMonitor;
}

// Auto-initialize
AppInitializer.onReady(init);
