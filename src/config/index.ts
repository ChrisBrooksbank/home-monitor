/**
 * Configuration Module
 * Unified access point for all configuration
 *
 * Usage:
 *   import { loadConfig, getConfig, isServiceConfigured, getProxyUrl } from '@config';
 *
 *   // At app startup (once):
 *   await loadConfig();
 *
 *   // After initialization:
 *   const config = getConfig();
 *   if (isServiceConfigured('hue')) { ... }
 *   const url = getProxyUrl('sonos');
 */

// Core config loader and accessors
export {
    loadConfig,
    getConfig,
    isConfigLoaded,
    isServiceConfigured,
    getProxyUrl,
    getRooms,
    getSensorToRoom,
    getLightPatterns,
    getMotionPatterns,
    getHubConfig,
    resetConfig,
    setConfig,
} from './loader';

// Schema and types
export { ConfigValidationError } from './schema';
export type { HomeConfig } from './schema';
