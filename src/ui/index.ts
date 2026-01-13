/**
 * UI Module Index
 * Re-exports all UI components
 */

export {
  loadSavedPosition,
  createDraggable,
  getPositionFromTransform,
  setPosition,
} from './draggable';

export {
  createThermometer,
  getTemperatureColor,
  getThermometerPosition,
  resetThermometerPositions,
  createSparkles,
  clearThermometers,
  ROOM_POSITIONS,
} from './thermometer';

export { ColorPicker } from './color-picker';
export { LayersPanel } from './layers';
