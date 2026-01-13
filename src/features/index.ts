/**
 * Features Module Index
 * Re-exports all feature modules
 */

// Weather and sky
export { Weather, fetchWeather, updateWeatherDisplay, getCachedWeather, getWeatherCategory } from './weather';
export type { WeatherData, WeatherCategory } from './weather';

export { Sky, fetchSunTimes, getTimeOfDay, getSkyConfig, updateSky, getSunPosition, isDaytime, isNighttime, getSunriseTime, getSunsetTime } from './sky';
export type { SkyConfig, SunTimes, TimeOfDay, SunPosition } from './sky';

// Temperature
export { Temperature, initTempHistory, saveTempData, getTempHistory, clearTempHistory, drawGraph, tempHistory } from './temperature';

// Device UIs
export { SonosUI } from './sonos';
export { TapoControls } from './tapo';
export { NestIntegration } from './nest';
export type { ThermostatStatus } from './nest';
export { ShieldUI } from './shield';

// Effects and animations
export { LightEffects, redAlert, partyMode, discoMode, waveEffect, sunsetMode, isEffectInProgress } from './effects';
export { MotionIndicators } from './motion-indicators';
export { PlaneSystem } from './news-plane';
export { MooseSystem } from './moose';
