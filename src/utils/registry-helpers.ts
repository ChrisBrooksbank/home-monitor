/**
 * Registry Helper Functions
 * Shared utilities for accessing registered services from the Registry
 */

import { Registry } from '../core/registry';
import type { AppConfig, HueConfig, WeatherConfig, NestConfig } from '../types';
import type { AppState as AppStateType } from '../core/state';
import type { AppEvents as AppEventsType } from '../core/events';

/**
 * Get APP_CONFIG from Registry
 */
export function getAppConfig(): AppConfig | undefined {
  return Registry.getOptional('APP_CONFIG');
}

/**
 * Get AppState from Registry
 */
export function getAppState(): typeof AppStateType | undefined {
  return Registry.getOptional('AppState');
}

/**
 * Get AppEvents from Registry
 */
export function getAppEvents(): typeof AppEventsType | undefined {
  return Registry.getOptional('AppEvents');
}

/**
 * Get HUE_CONFIG from Registry
 */
export function getHueConfig(): HueConfig | undefined {
  return Registry.getOptional('HUE_CONFIG');
}

/**
 * Get WEATHER_CONFIG from Registry
 */
export function getWeatherConfig(): WeatherConfig | undefined {
  return Registry.getOptional('WEATHER_CONFIG');
}

/**
 * Get NEST_CONFIG from Registry
 */
export function getNestConfig(): NestConfig | undefined {
  return Registry.getOptional('NEST_CONFIG');
}
