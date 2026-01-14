/**
 * Temperature Module Index
 * Re-exports temperature sensor and UI functionality
 */

// Sensor and history management
export {
  TemperatureSensorsModule,
  getTempHistory,
  initTempHistory,
  saveTempData,
  loadTemperatures,
} from './temperature-sensors';

// UI rendering
export { ThermometerUI, createThermometer, createSparkles } from './thermometer-ui';
