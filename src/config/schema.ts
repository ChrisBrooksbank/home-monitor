/**
 * Configuration Schema Definitions
 * Defines required fields and validation rules for all config sections
 */

export interface SchemaDefinition {
  name: string;
  required: string[];
  optional: string[];
  validators: Record<string, (value: unknown) => boolean>;
  errors: Record<string, string>;
}

export const SCHEMAS: Record<string, SchemaDefinition> = {
  hue: {
    name: 'Hue Bridge',
    required: ['BRIDGE_IP', 'USERNAME'],
    optional: [],
    validators: {
      BRIDGE_IP: (v) =>
        typeof v === 'string' && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v),
      USERNAME: (v) => typeof v === 'string' && v.length > 10,
    },
    errors: {
      BRIDGE_IP: 'Must be a valid IP address (e.g., 192.168.1.100)',
      USERNAME: 'Must be a valid Hue API username (40+ characters)',
    },
  },

  weather: {
    name: 'Weather API',
    required: ['API_KEY', 'LOCATION'],
    optional: ['UPDATE_INTERVAL'],
    validators: {
      API_KEY: (v) =>
        typeof v === 'string' && v.length > 10 && !v.includes('YOUR'),
      LOCATION: (v) => typeof v === 'string' && v.length > 0,
    },
    errors: {
      API_KEY:
        'Must be a valid WeatherAPI.com key (get one at weatherapi.com/signup.aspx)',
      LOCATION: 'Must be a location string (e.g., UK postcode)',
    },
  },

  nest: {
    name: 'Nest Thermostat',
    required: ['CLIENT_ID', 'CLIENT_SECRET', 'PROJECT_ID'],
    optional: ['ACCESS_TOKEN', 'REFRESH_TOKEN', 'DEVICE_ID'],
    validators: {
      CLIENT_ID: (v) =>
        typeof v === 'string' && v.includes('.apps.googleusercontent.com'),
      CLIENT_SECRET: (v) => typeof v === 'string' && v.length > 10,
      PROJECT_ID: (v) => typeof v === 'string' && v.length > 0,
    },
    errors: {
      CLIENT_ID:
        'Must be a Google OAuth Client ID ending in .apps.googleusercontent.com',
      CLIENT_SECRET: 'Must be a valid Google OAuth client secret',
      PROJECT_ID: 'Must be a Smart Device Management project ID',
    },
  },

  devices: {
    name: 'Devices Registry',
    required: [],
    optional: ['sonos', 'tapo', 'hub', 'shield'],
    validators: {
      sonos: (v) => typeof v === 'object' && v !== null,
      tapo: (v) => typeof v === 'object' && v !== null,
      hub: (v) =>
        typeof v === 'object' && v !== null && 'ip' in (v as Record<string, unknown>),
      shield: (v) =>
        typeof v === 'object' && v !== null && 'ip' in (v as Record<string, unknown>),
    },
    errors: {
      sonos: 'Must be an object mapping names to IP addresses',
      tapo: 'Must be an object mapping names to IP addresses',
      hub: 'Must be an object with ip property',
      shield: 'Must be an object with ip property',
    },
  },

  app: {
    name: 'App Config',
    required: ['proxies', 'intervals', 'timeouts'],
    optional: ['retry', 'debug'],
    validators: {
      proxies: (v) => {
        const obj = v as Record<string, unknown>;
        return typeof v === 'object' && v !== null && !!obj.sonos && !!obj.tapo;
      },
      intervals: (v) => {
        const obj = v as Record<string, unknown>;
        return typeof v === 'object' && typeof obj.temperatures === 'number';
      },
      timeouts: (v) => {
        const obj = v as Record<string, unknown>;
        return typeof v === 'object' && typeof obj.apiRequest === 'number';
      },
    },
    errors: {
      proxies: 'Must define sonos, tapo, and shield proxy URLs',
      intervals: 'Must define polling intervals',
      timeouts: 'Must define API timeouts',
    },
  },
};

export const ConfigSchema = { SCHEMAS };
