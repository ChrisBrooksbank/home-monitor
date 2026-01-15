/**
 * Application Constants
 * Centralized configuration values
 */

import type { AppConfig } from '../types';
import { Registry } from '../core/registry';

// Time constants
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

// History retention periods
export const MOTION_HISTORY_RETENTION = 48 * MS_PER_HOUR;
export const TEMP_HISTORY_RETENTION = 24 * MS_PER_HOUR;

// Chelmsford coordinates (for weather/sun times)
export const LOCATION = {
  LAT: 51.7356,
  LNG: 0.4685,
  NAME: 'Chelmsford, Essex, UK',
};

// Temperature range for graph
export const TEMPERATURE = {
  MIN_DISPLAY: 0,
  MAX_DISPLAY: 30,
  BUFFER: 2,
};

// Graph dimensions
export const GRAPH = {
  WIDTH: 1100,
  HEIGHT: 300,
  MARGIN_LEFT: 50,
  MARGIN_BOTTOM: 50,
};

export const APP_CONFIG: AppConfig = {
  // Proxy Server URLs
  proxies: {
    sonos: 'http://localhost:3000',
    tapo: 'http://localhost:3001',
    shield: 'http://localhost:8082',
  },

  // Update Intervals (in milliseconds)
  intervals: {
    motionSensors: 3000,
    lights: 10000,
    sensorDetails: 10000,
    temperatures: 60000,
    motionLog: 60000,
    sky: 60000,
    sunTimes: 24 * 60 * 60 * 1000,
    weather: 15 * 60 * 1000,
    nest: 15 * 60 * 1000,
    sonosVolume: 30000,
    tapoStatus: 30000,
    connectionStatus: 30000,
  },

  // API Timeouts (in milliseconds)
  timeouts: {
    proxyCheck: 2000,
    apiRequest: 10000,
  },

  // Retry Configuration
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },

  // Debug Mode
  debug: false,
};

// Register with the service registry
Registry.register({
  key: 'APP_CONFIG',
  instance: APP_CONFIG,
});
