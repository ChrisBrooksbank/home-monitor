/**
 * Config Module Index
 * Re-exports all configuration
 */

// Constants and location
export { LOCATION, APP_CONFIG } from './constants';

// Config facade (unified access)
export { Config, ConfigStatus, withConfiguredFeature } from './Config';

// Environment utilities
export { Env } from './env';

// Validation schemas
export { HueConfigSchema, WeatherConfigSchema, NestConfigSchema, validateConfig } from './schemas';
export type {
    HueConfigValidated,
    WeatherConfigValidated,
    NestConfigValidated,
    ValidationResult,
} from './schemas';
