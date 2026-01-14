/**
 * Lights Module Index
 * Re-exports light control and UI functionality
 */

export {
  Lights,
  getRoomLights,
  getPreviousLightStates,
  loadLights,
  toggleLight,
  updateLightIndicators,
  createPixelBulb,
} from './lights';
export type { LightInfoExtended } from './lights';

export { Lamppost, updateOutdoorLamppost, initLamppostDraggable } from './lamppost';
