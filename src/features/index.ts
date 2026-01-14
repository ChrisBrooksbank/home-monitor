/**
 * Features Module Index
 * Re-exports all feature modules
 */

// Weather and sky
export { Weather, fetchWeather, updateWeatherDisplay, getCachedWeather, getWeatherCategory } from './weather';
export type { WeatherData, WeatherCategory } from './weather';

export { Sky, fetchSunTimes, getTimeOfDay, getSkyConfig, updateSky, getSunPosition, isDaytime, isNighttime, getSunriseTime, getSunsetTime } from './sky';
export type { SkyConfig, SunTimes, TimeOfDay, SunPosition } from './sky';

// Temperature (subfolder module)
export {
  TemperatureSensorsModule,
  getTempHistory,
  initTempHistory,
  saveTempData,
  loadTemperatures,
  ThermometerUI,
  createThermometer,
  createSparkles,
} from './temperature';

// Legacy temperature exports (graph drawing)
export { Temperature, clearTempHistory, drawGraph, tempHistory } from './temperature.legacy';

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

// Voice
export { VoiceAnnouncements, announceMotion, announceLight } from './voice';

// Connection status
export {
  ConnectionStatusDisplay,
  initWheelieBinDraggable,
  updateBinLed,
  toggleBinPopup,
  initBinStatusDisplay,
} from './connection';

// Lights
export {
  Lights,
  getRoomLights,
  getPreviousLightStates,
  loadLights,
  toggleLight,
  updateLightIndicators,
  createPixelBulb,
  Lamppost,
  updateOutdoorLamppost,
  initLamppostDraggable,
} from './lights';
export type { LightInfoExtended } from './lights';

// Motion
export {
  MotionSensorsModule,
  getMotionSensors,
  getMotionHistory,
  initMotionHistory,
  logMotionEvent,
  updateMotionLogDisplay,
  loadMotionSensors,
} from './motion';
