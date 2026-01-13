/**
 * Config Module Index
 * Re-exports all configuration
 */

export {
  APP_CONFIG,
  MS_PER_SECOND,
  MS_PER_MINUTE,
  MS_PER_HOUR,
  MS_PER_DAY,
  MOTION_HISTORY_RETENTION,
  TEMP_HISTORY_RETENTION,
  LOCATION,
  TEMPERATURE,
  GRAPH,
} from './constants';
export {
  sensorMapping,
  roomNames,
  roomColors,
  roomPositions,
  lightMappings,
  motionSensorMappings,
  lightPositions,
  rooms,
  mapLightToRoom,
  mapMotionSensorToRoom,
  MAPPINGS,
} from './mappings';
export { SCHEMAS, ConfigSchema } from './schema';
export type { SchemaDefinition } from './schema';
export {
  ConfigLoader,
  ValidationResult,
  validateConfig,
  loadConfig,
} from './loader';
export type { UnifiedConfig } from './loader';
