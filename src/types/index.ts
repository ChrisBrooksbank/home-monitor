/**
 * Shared Type Definitions for Home Monitor
 * Central type definitions used across the application
 */

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

export interface ProxyConfig {
  sonos: string;
  tapo: string;
  shield: string;
  nest: string;
}

export interface IntervalsConfig {
  motionSensors: number;
  lights: number;
  sensorDetails: number;
  temperatures: number;
  motionLog: number;
  sky: number;
  sunTimes: number;
  weather: number;
  nest: number;
  sonosVolume: number;
  tapoStatus: number;
  connectionStatus: number;
}

export interface TimeoutsConfig {
  proxyCheck: number;
  apiRequest: number;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface AppConfig {
  proxies: ProxyConfig;
  intervals: IntervalsConfig;
  timeouts: TimeoutsConfig;
  retry: RetryConfig;
  debug: boolean;
}

export interface HueConfig {
  BRIDGE_IP: string;
  USERNAME: string;
}

export interface WeatherConfig {
  API_KEY: string;
}

export interface NestConfig {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  PROJECT_ID: string;
  REDIRECT_URI: string;
  ACCESS_TOKEN?: string;
  REFRESH_TOKEN?: string;
}

// =============================================================================
// HUE API TYPES
// =============================================================================

export interface HueLightState {
  on: boolean;
  bri?: number;
  hue?: number;
  sat?: number;
  ct?: number;
  xy?: [number, number];
  colormode?: 'hs' | 'ct' | 'xy';
  reachable: boolean;
  alert?: string;
  effect?: string;
  transitiontime?: number;
}

export interface HueLight {
  state: HueLightState;
  type: string;
  name: string;
  modelid: string;
  manufacturername: string;
  productname: string;
  uniqueid: string;
  swversion: string;
}

export interface HueLightsResponse {
  [id: string]: HueLight;
}

export interface HueSensorState {
  temperature?: number;
  presence?: boolean;
  lightlevel?: number;
  dark?: boolean;
  daylight?: boolean;
  lastupdated: string;
  buttonevent?: number;
}

export interface HueSensorConfig {
  on: boolean;
  battery?: number;
  reachable?: boolean;
  alert?: string;
  sensitivity?: number;
  sensitivitymax?: number;
  ledindication?: boolean;
  usertest?: boolean;
  pending?: unknown[];
}

export interface HueSensor {
  state: HueSensorState;
  config: HueSensorConfig;
  name: string;
  type: string;
  modelid: string;
  manufacturername: string;
  productname?: string;
  swversion: string;
  uniqueid: string;
}

export interface HueSensorsResponse {
  [id: string]: HueSensor;
}

export interface HueBridgeConfig {
  name: string;
  datastoreversion: string;
  swversion: string;
  apiversion: string;
  mac: string;
  bridgeid: string;
  factorynew: boolean;
  replacesbridgeid: string | null;
  modelid: string;
  starterkitid: string;
}

export interface HueBridgeDiscovery {
  ip: string;
  name: string;
  model: string;
  bridgeId: string;
  apiVersion: string;
}

// =============================================================================
// ROOM & MAPPING TYPES
// =============================================================================

export type RoomName =
  | 'Main Bedroom'
  | 'Guest Bedroom'
  | 'Bathroom'
  | 'Landing'
  | 'Hall'
  | 'Home Office'
  | 'Lounge'
  | 'Kitchen'
  | 'Extension'
  | 'Outdoor';

export interface RoomPosition {
  x: number;
  y: number;
  isOutdoor?: boolean;
}

export interface LightInfo {
  id: string;
  name: string;
  on: boolean;
  reachable: boolean;
  color: string | null;
}

export type RoomLights = Record<RoomName, LightInfo[]>;

export interface MotionSensorState {
  detected: boolean;
  lastUpdated: Date | null;
}

export type MotionSensors = Record<string, MotionSensorState>;

// =============================================================================
// SONOS TYPES
// =============================================================================

export interface SonosCommand {
  service: 'AVTransport' | 'RenderingControl';
  path: string;
  params: Record<string, string | number | null>;
}

export interface SonosSpeaker {
  ip: string;
  room: string;
  model: string;
}

export interface SonosSpeakersResponse {
  speakers: Record<string, SonosSpeaker>;
  lastDiscovery: string | null;
  count: number;
}

export interface SonosDiscoveryResponse {
  success: boolean;
  speakers: Record<string, SonosSpeaker>;
  count: number;
  discoveredAt: string;
}

export interface SoapResponse {
  ok: boolean;
  status?: number;
  body?: string;
  error?: string;
}

// =============================================================================
// TAPO TYPES
// =============================================================================

export interface TapoPlug {
  ip: string;
  name: string;
  model?: string;
  mac?: string;
}

export interface TapoPlugsResponse {
  plugs: Record<string, TapoPlug>;
  count: number;
}

export interface TapoStatusResponse {
  state: 'on' | 'off';
  device_on?: boolean;
  nickname?: string;
  model?: string;
  device_id?: string;
}

export interface TapoToggleResponse {
  success: boolean;
  plug: string;
  state: 'on' | 'off';
}

// =============================================================================
// SHIELD TYPES
// =============================================================================

export interface ShieldDevice {
  ip: string;
  name: string;
  status: 'connected' | 'disconnected';
}

export interface ShieldKeyEvent {
  keycode: number;
  action: 'press' | 'longpress';
}

// =============================================================================
// NEST TYPES
// =============================================================================

export interface NestThermostat {
  name: string;
  displayName: string;
  traits: {
    'sdm.devices.traits.Temperature'?: {
      ambientTemperatureCelsius: number;
    };
    'sdm.devices.traits.ThermostatTemperatureSetpoint'?: {
      heatCelsius?: number;
      coolCelsius?: number;
    };
    'sdm.devices.traits.ThermostatMode'?: {
      mode: 'HEAT' | 'COOL' | 'HEATCOOL' | 'OFF';
      availableModes: string[];
    };
    'sdm.devices.traits.Humidity'?: {
      ambientHumidityPercent: number;
    };
    'sdm.devices.traits.ThermostatHvac'?: {
      status: 'OFF' | 'HEATING' | 'COOLING';
    };
  };
}

export interface NestDevicesResponse {
  devices: NestThermostat[];
}

// =============================================================================
// WEATHER TYPES
// =============================================================================

export interface WeatherCondition {
  text: string;
  icon: string;
  code: number;
}

export interface WeatherCurrent {
  temp_c: number;
  temp_f: number;
  condition: WeatherCondition;
  humidity: number;
  cloud: number;
  feelslike_c: number;
  feelslike_f: number;
  uv: number;
  wind_kph: number;
  wind_mph: number;
  wind_dir: string;
  pressure_mb: number;
  precip_mm: number;
  is_day: number;
}

export interface WeatherLocation {
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  localtime: string;
}

export interface WeatherResponse {
  location: WeatherLocation;
  current: WeatherCurrent;
}

// =============================================================================
// SUN TIMES TYPES
// =============================================================================

export interface SunTimesResults {
  sunrise: string;
  sunset: string;
  solar_noon: string;
  day_length: number;
  civil_twilight_begin: string;
  civil_twilight_end: string;
  nautical_twilight_begin: string;
  nautical_twilight_end: string;
  astronomical_twilight_begin: string;
  astronomical_twilight_end: string;
}

export interface SunTimesResponse {
  results: SunTimesResults;
  status: 'OK' | 'ERROR';
}

// =============================================================================
// STATE TYPES
// =============================================================================

export interface ConnectionStatus {
  online: boolean;
  lastCheck: Date | null;
  name?: string | null;
  apiVersion?: string | null;
  uptime?: number | null;
  error?: string | null;
}

export interface ConnectionsState {
  hue: ConnectionStatus;
  sonos: ConnectionStatus;
  tapo: ConnectionStatus;
  shield: ConnectionStatus;
  nest: ConnectionStatus;
}

export interface NestState {
  devices: NestThermostat[];
  currentTemp: number | null;
  targetTemp: number | null;
  mode: string | null;
}

export interface EffectState {
  inProgress: boolean;
  currentEffect: string | null;
  originalStates: Record<string, HueLightState>;
}

export interface AppStateData {
  ready: boolean;
  viewMode: 'full' | 'compact';
  lastUpdate: number | null;
}

export interface TemperatureReading {
  sensorId: string;
  room: string;
  temp: number;
  lastUpdated: string;
}

export interface TemperatureHistoryEntry {
  time: number;
  temp: number;
}

export interface MotionHistoryEntry {
  type: 'motion';
  location: string;
  room: string;
  time: number;
}

export interface StateStore {
  lights: RoomLights;
  previousLightStates: Record<string, boolean>;
  motion: MotionSensors;
  temperatures: Record<string, number>;
  tempHistory: Record<string, TemperatureHistoryEntry[]>;
  motionHistory: MotionHistoryEntry[];
  plugs: Record<string, boolean>;
  speakers: Record<string, SonosSpeaker>;
  speakerVolumes: Record<string, number>;
  nest: NestState;
  connections: ConnectionsState;
  positions: Record<string, { x: number; y: number }>;
  effect: EffectState;
  app: AppStateData;
  // Index signature for dynamic access
  [key: string]: unknown;
}

// =============================================================================
// EVENT TYPES
// =============================================================================

export interface EventMeta {
  event: string;
  timestamp: number;
  wildcard?: string;
}

export type EventCallback<T = unknown> = (data: T, meta: EventMeta) => void;

export interface EventHistoryEntry {
  event: string;
  data: unknown;
  timestamp: number;
}

// Standard event payloads
export interface ConnectionHueOnlineEvent {
  name: string;
  apiVersion: string;
}

export interface ConnectionHueOfflineEvent {
  bridgeIp: string;
}

export interface ConnectionProxyEvent {
  proxy: 'sonos' | 'tapo' | 'shield';
  uptime?: number;
}

export interface MotionDetectedEvent {
  room: string;
  sensorId: string;
  sensorName: string;
  timestamp: number;
}

export interface LightChangedEvent {
  room: RoomName;
  lightId: string;
  lightName: string;
  on: boolean;
  reachable: boolean;
}

export interface TemperatureUpdatedEvent {
  readings: TemperatureReading[];
  timestamp: number;
}

export interface EffectEvent {
  effect: string;
  timestamp: number;
}

export interface TapoToggledEvent {
  plug: string;
  on: boolean;
  timestamp: number;
}

export interface AppReadyEvent {
  timestamp: number;
  features: {
    hue: boolean;
    sonos: boolean;
    tapo: boolean;
    shield: boolean;
  };
}

export interface StateChangedEvent<T = unknown> {
  key: string;
  value: T;
  oldValue?: T;
  subKey?: string;
  timestamp: number;
}

// =============================================================================
// POLLING TYPES
// =============================================================================

export interface PollingTask {
  name: string;
  fn: () => Promise<void> | void;
  originalFn: () => Promise<void> | void;
  interval: number;
  enabled: boolean;
  condition: (() => boolean) | null;
  intervalId: ReturnType<typeof setInterval> | null;
}

export interface PollingTaskStatus {
  name: string;
  interval: number;
  enabled: boolean;
  running: boolean;
  hasCondition: boolean;
}

export interface RegisterTaskOptions {
  guarded?: boolean;
  condition?: () => boolean;
  runImmediately?: boolean;
}

// =============================================================================
// UI TYPES
// =============================================================================

export interface DraggableOptions {
  storageKey?: string;
  excludeSelector?: string | null;
  cursor?: string;
  activeCursor?: string | null;
  onStart?: (e: MouseEvent | TouchEvent) => boolean | void;
  onMove?: (data: DragMoveData) => void;
  onEnd?: (e: MouseEvent | TouchEvent, element: SVGElement | HTMLElement) => void;
  customSave?: (element: SVGElement | HTMLElement) => void;
}

export interface DragMoveData {
  dx: number;
  dy: number;
  clientX: number;
  clientY: number;
  startX: number;
  startY: number;
  currentTransform: TransformData;
  element: SVGElement | HTMLElement;
}

export interface TransformData {
  x: number;
  y: number;
  scale: string;
  rotate: string;
}

export interface Position {
  x: number;
  y: number;
}

// =============================================================================
// PROXY SERVER TYPES
// =============================================================================

export interface HealthCheckResponse {
  status: 'ok';
  service: string;
  uptime: number;
  timestamp: string;
}

export interface ProxyErrorResponse {
  error: string;
  code?: string;
  details?: string;
}

// =============================================================================
// LOGGER TYPES
// =============================================================================

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface LogLevels {
  DEBUG: 0;
  INFO: 1;
  WARN: 2;
  ERROR: 3;
}

// =============================================================================
// FEATURE REGISTRATION TYPES
// =============================================================================

export interface FeatureConfig {
  init: () => Promise<void> | void;
  condition?: () => boolean;
  dependencies?: string[];
  priority?: number;
}

export interface Feature extends FeatureConfig {
  name: string;
  initialized: boolean;
}

// =============================================================================
// GLOBAL DECLARATIONS
// =============================================================================

declare global {
  interface Window {
    APP_CONFIG?: AppConfig;
    HUE_CONFIG?: HueConfig;
    WEATHER_CONFIG?: WeatherConfig & { LOCATION?: string };
    NEST_CONFIG?: NestConfig;
    CONFIG?: unknown;
    MAPPINGS: typeof import('../config/mappings').MAPPINGS;
    Logger: typeof import('../utils/logger').Logger;
    IntervalManager: typeof import('../utils/helpers').IntervalManager;
    AppEvents: typeof import('../core/events').AppEvents;
    AppState: typeof import('../core/state').AppState;
    Poller: typeof import('../core/poller').Poller;
    ConnectionMonitor: typeof import('../core/connection-monitor').ConnectionMonitor;
    AppInitializer: typeof import('../core/initializer').AppInitializer;
    HueAPI: typeof import('../api/hue').HueAPI;
    SonosAPI: typeof import('../api/sonos').SonosAPI;
    TapoAPI: typeof import('../api/tapo').TapoAPI;
    HomeMonitor?: unknown;
    TapoControls?: unknown;
    createDraggable: typeof import('../ui/draggable').createDraggable;
    loadSavedPosition: typeof import('../ui/draggable').loadSavedPosition;
    toggleViewMode: () => void;
  }

  // Vite env types
  const __DEV__: boolean;
  const __PROD__: boolean;
}

export {};
