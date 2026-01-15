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
  AppConfig,
} from './types';
import { Logger } from './utils/logger';
import { Registry } from './core/registry';
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
// REGISTRY HELPERS
// =============================================================================

function getAppEvents() {
  return Registry.getOptional('AppEvents');
}

function getAppConfig() {
  return Registry.getOptional('APP_CONFIG') as AppConfig | undefined;
}

function getTapoControls() {
  return Registry.getOptional('TapoControls') as { init: () => Promise<void> } | undefined;
}

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
  const appEvents = getAppEvents();
  const appConfig = getAppConfig();

  if (!appEvents) {
    Logger.warn('AppEvents not available, skipping event subscriptions');
    return;
  }

  // Motion detection -> voice announcement
  // (MotionIndicators handles its own subscription for visual indicators)
  appEvents.on<MotionDetectedEvent>('motion:detected', (data) => {
    announceMotion(data.room);
  });

  // Light state change -> voice announcement
  appEvents.on<LightChangedEvent>('light:changed', (data) => {
    announceLight(data.room, data.on);
  });

  // Connection status changes -> logging
  appEvents.on<ConnectionHueOnlineEvent>('connection:hue:online', (data) => {
    Logger.success(`Hue Bridge connected: ${data.name}`);
  });

  appEvents.on('connection:hue:offline', () => {
    Logger.warn('Hue Bridge disconnected');
  });

  appEvents.on<ConnectionProxyEvent>('connection:proxy:online', (data) => {
    Logger.success(`${data.proxy} proxy connected`);
  });

  appEvents.on<ConnectionProxyEvent>('connection:proxy:offline', (data) => {
    Logger.warn(`${data.proxy} proxy disconnected`);
  });

  // Debug: log all events in debug mode
  if (appConfig?.debug) {
    appEvents.on('*', (data: unknown, meta: EventMeta) => {
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
    const tapoControls = getTapoControls();
    if (tapoControls?.init) {
      if (ConnectionMonitor.isOnline('tapo')) {
        Logger.info('Initializing Tapo controls...');
        await tapoControls.init();
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
  const appConfig = getAppConfig();
  Poller.register(
    'connectionStatus',
    async () => { await ConnectionMonitor.checkAll(); },
    appConfig?.intervals?.connectionStatus ?? 30000
  );
  Poller.register('motionSensors', loadMotionSensors, appConfig?.intervals?.motionSensors ?? 3000);
  Poller.register('lights', loadLights, appConfig?.intervals?.lights ?? 10000);
  Poller.register('temperatures', () => loadTemperatures(false), appConfig?.intervals?.temperatures ?? 60000);
  Poller.register('motionLog', updateMotionLogDisplay, appConfig?.intervals?.motionLog ?? 60000);
  Poller.register('sky', updateSky, appConfig?.intervals?.sky ?? 60000);
  Poller.register('sunTimes', async () => { await fetchSunTimes(); }, appConfig?.intervals?.sunTimes ?? 86400000);
  Poller.register('weather', async () => { await updateWeatherDisplay(); }, appConfig?.intervals?.weather ?? 900000);

  // Start all polling
  Poller.startAll();

  Logger.success('Home Monitor initialized!');

  // Emit app ready event
  // Note: MooseSystem subscribes to this event and auto-initializes
  getAppEvents()?.emit('app:ready', {
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

// Register toggleSection with Registry
Registry.register({
  key: 'toggleSection',
  instance: toggleSection,
});

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

// Register with the service registry
Registry.register({
  key: 'HomeMonitor',
  instance: HomeMonitor,
});

// Auto-initialize
AppInitializer.onReady(init);
