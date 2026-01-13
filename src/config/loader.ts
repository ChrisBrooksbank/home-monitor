/**
 * Configuration Loader with Validation
 * Loads and validates all configuration sources
 */

import { SCHEMAS, SchemaDefinition } from './schema';
import type { HueConfig, WeatherConfig, NestConfig, AppConfig } from '../types';

// Window types are declared in types/index.ts

const CONFIG_SOURCES = {
  HUE: 'config.js (HUE_CONFIG)',
  WEATHER: 'config.js (WEATHER_CONFIG)',
  NEST: 'nest-config.js (NEST_CONFIG)',
  DEVICES: 'config/devices.json',
  APP: 'js/config.js (APP_CONFIG)',
} as const;

interface ValidationError {
  source: string;
  field: string;
  message: string;
}

interface DevicesConfig {
  sonos?: Record<string, string>;
  tapo?: Record<string, string>;
  hub?: { ip: string };
  shield?: { ip: string };
}

export interface UnifiedConfig {
  hue: HueConfig | Record<string, never>;
  weather: (WeatherConfig & { LOCATION?: string }) | Record<string, never>;
  nest: NestConfig | Record<string, never>;
  devices: DevicesConfig;
  app: AppConfig | Record<string, never>;
  bridgeUrl: string | null;
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  hasFeature: (name: string) => boolean;
}

/**
 * Validation result class
 */
export class ValidationResult {
  valid = true;
  errors: ValidationError[] = [];
  warnings: ValidationError[] = [];

  addError(source: string, field: string, message: string): void {
    this.valid = false;
    this.errors.push({ source, field, message });
  }

  addWarning(source: string, field: string, message: string): void {
    this.warnings.push({ source, field, message });
  }

  log(): void {
    if (this.errors.length > 0) {
      console.group('%c Configuration Errors', 'color: #e74c3c; font-weight: bold');
      this.errors.forEach((e) => {
        console.error(`[${e.source}] ${e.field}: ${e.message}`);
      });
      console.groupEnd();
    }

    if (this.warnings.length > 0) {
      console.group(
        '%c Configuration Warnings',
        'color: #f39c12; font-weight: bold'
      );
      this.warnings.forEach((w) => {
        console.warn(`[${w.source}] ${w.field}: ${w.message}`);
      });
      console.groupEnd();
    }

    if (this.valid && this.warnings.length === 0) {
      console.log('%c Configuration loaded successfully', 'color: #27ae60');
    }
  }
}

/**
 * Validate a config object against a schema
 */
export function validateConfig(
  config: unknown,
  schemaName: string,
  sourceName: string
): ValidationResult {
  const result = new ValidationResult();
  const schema: SchemaDefinition | undefined = SCHEMAS[schemaName];

  if (!schema) {
    result.addError(sourceName, 'schema', `Unknown schema: ${schemaName}`);
    return result;
  }

  if (!config) {
    result.addError(sourceName, 'config', `Configuration not found. Create ${sourceName}`);
    return result;
  }

  const configObj = config as Record<string, unknown>;

  // Check required fields
  for (const field of schema.required) {
    const value = configObj[field];
    if (value === undefined || value === null || value === '') {
      result.addError(sourceName, field, 'Required field missing');
    } else if (schema.validators?.[field] && !schema.validators[field](value)) {
      result.addError(sourceName, field, schema.errors?.[field] || 'Invalid value');
    }
  }

  // Check optional fields if present
  for (const field of schema.optional) {
    const value = configObj[field];
    if (value !== undefined && schema.validators?.[field]) {
      if (!schema.validators[field](value)) {
        result.addWarning(sourceName, field, schema.errors?.[field] || 'Invalid value');
      }
    }
  }

  return result;
}

/**
 * Load devices.json asynchronously
 */
async function loadDevices(): Promise<DevicesConfig | null> {
  try {
    const response = await fetch('/config/devices.json');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[Config] Could not load devices.json:', message);
    return null;
  }
}

/**
 * Main config loader - validates all configs and returns unified object
 */
export async function loadConfig(): Promise<UnifiedConfig> {
  const result = new ValidationResult();

  // Validate HUE_CONFIG
  const hueResult = validateConfig(window.HUE_CONFIG, 'hue', CONFIG_SOURCES.HUE);
  result.errors.push(...hueResult.errors);
  result.warnings.push(...hueResult.warnings);
  if (!hueResult.valid) result.valid = false;

  // Validate WEATHER_CONFIG (optional but recommended)
  if (window.WEATHER_CONFIG) {
    const weatherResult = validateConfig(
      window.WEATHER_CONFIG,
      'weather',
      CONFIG_SOURCES.WEATHER
    );
    result.warnings.push(...weatherResult.errors); // Weather is optional, demote to warnings
    result.warnings.push(...weatherResult.warnings);
  } else {
    result.addWarning(
      CONFIG_SOURCES.WEATHER,
      'config',
      'Weather config not found - weather features disabled'
    );
  }

  // Validate NEST_CONFIG (optional)
  if (window.NEST_CONFIG) {
    const nestResult = validateConfig(window.NEST_CONFIG, 'nest', CONFIG_SOURCES.NEST);
    result.warnings.push(...nestResult.errors); // Nest is optional
    result.warnings.push(...nestResult.warnings);
  }

  // Validate APP_CONFIG
  const appResult = validateConfig(window.APP_CONFIG, 'app', CONFIG_SOURCES.APP);
  result.errors.push(...appResult.errors);
  result.warnings.push(...appResult.warnings);
  if (!appResult.valid) result.valid = false;

  // Load devices.json
  const devices = await loadDevices();
  if (devices) {
    const devicesResult = validateConfig(devices, 'devices', CONFIG_SOURCES.DEVICES);
    result.warnings.push(...devicesResult.errors);
    result.warnings.push(...devicesResult.warnings);
  }

  // Log validation results
  result.log();

  // Build unified config object
  const CONFIG: UnifiedConfig = {
    hue: window.HUE_CONFIG || {},
    weather: window.WEATHER_CONFIG || {},
    nest: window.NEST_CONFIG || {},
    devices: devices || {},
    app: window.APP_CONFIG || {},

    get bridgeUrl(): string | null {
      const hue = this.hue as HueConfig;
      return hue.BRIDGE_IP ? `http://${hue.BRIDGE_IP}/api/${hue.USERNAME}` : null;
    },

    get isValid(): boolean {
      return result.valid;
    },

    get errors(): ValidationError[] {
      return result.errors;
    },

    get warnings(): ValidationError[] {
      return result.warnings;
    },

    hasFeature(name: string): boolean {
      switch (name) {
        case 'hue': {
          const hue = this.hue as HueConfig;
          return !!hue.BRIDGE_IP && !!hue.USERNAME;
        }
        case 'weather': {
          const weather = this.weather as WeatherConfig & { API_KEY?: string };
          return !!weather.API_KEY && !weather.API_KEY.includes('YOUR');
        }
        case 'nest': {
          const nest = this.nest as NestConfig;
          return !!nest.ACCESS_TOKEN;
        }
        case 'sonos':
          return Object.keys(this.devices.sonos || {}).length > 0;
        case 'tapo':
          return Object.keys(this.devices.tapo || {}).length > 0;
        case 'shield':
          return !!this.devices.shield?.ip;
        default:
          return false;
      }
    },
  };

  // Store globally
  window.CONFIG = CONFIG;

  return CONFIG;
}

export const ConfigLoader = {
  load: loadConfig,
  validate: validateConfig,
  ValidationResult,
};
