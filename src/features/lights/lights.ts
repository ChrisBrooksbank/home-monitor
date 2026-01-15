/**
 * Lights Module
 * Handles Hue light data loading, state management, and UI rendering
 */

import type { RoomName, RoomLights, LightInfo } from '../../types';
import { Logger } from '../../utils/logger';
import { HueAPI } from '../../api/hue';
import { MAPPINGS, mapLightToRoom } from '../../config/mappings';
import { hueStateToColor, darkenColor } from '../../utils/color-utils';
import { updateOutdoorLamppost } from './lamppost';
import { Registry } from '../../core/registry';

// Extended light info with color picker properties
export interface LightInfoExtended extends LightInfo {
  colormode?: 'hs' | 'ct' | 'xy';
  hue?: number;
  sat?: number;
  bri?: number;
  ct?: number;
}

// Helpers to get services from Registry
function getAppState() {
  return Registry.getOptional('AppState');
}
function getAppEvents() {
  return Registry.getOptional('AppEvents');
}
function getColorPicker() {
  return Registry.getOptional('ColorPicker') as { handleBulbClick: (id: string, light: LightInfoExtended, e: MouseEvent) => void } | undefined;
}

/**
 * Get room lights from AppState
 */
export function getRoomLights(): RoomLights {
  const appState = getAppState();
  return (
    appState?.get<RoomLights>('lights') ?? {
      'Main Bedroom': [],
      'Guest Bedroom': [],
      Landing: [],
      'Home Office': [],
      Bathroom: [],
      Lounge: [],
      Hall: [],
      Extension: [],
      Kitchen: [],
      Outdoor: [],
    }
  );
}

/**
 * Get previous light states from AppState
 */
export function getPreviousLightStates(): Record<string, boolean> {
  const appState = getAppState();
  return appState?.get<Record<string, boolean>>('previousLightStates') ?? {};
}

/**
 * Toggle a light on/off
 */
export async function toggleLight(lightId: string, currentState: boolean): Promise<void> {
  try {
    const success = await HueAPI.setLightState(lightId, { on: !currentState });
    if (success) setTimeout(loadLights, 500);
  } catch (error) {
    Logger.error('Error toggling light:', error);
  }
}

/**
 * Creates a pixel-art style Edison light bulb
 */
export function createPixelBulb(
  ns: string,
  cx: number,
  cy: number,
  light: LightInfoExtended
): SVGGElement {
  const group = document.createElementNS(ns, 'g') as SVGGElement;
  group.setAttribute('class', 'pixel-bulb');
  group.style.cursor = 'pointer';

  const isOn = light.on;
  const bulbColor = isOn ? light.color || '#FFD700' : '#4A4A4A';
  const glassColor = isOn ? light.color || '#FFF8DC' : '#8B8B8B';
  const filamentColor = isOn ? '#FF8C00' : '#5A5A5A';

  // Glow effect when on
  if (isOn) {
    const glow = document.createElementNS(ns, 'ellipse');
    glow.setAttribute('cx', String(cx));
    glow.setAttribute('cy', String(cy - 4));
    glow.setAttribute('rx', '14');
    glow.setAttribute('ry', '12');
    glow.setAttribute('fill', light.color || '#FFD700');
    glow.setAttribute('opacity', '0.3');
    glow.setAttribute('filter', 'url(#glow)');
    group.appendChild(glow);
  }

  // Bulb glass (main bulb shape - rounded top)
  const bulbGlass = document.createElementNS(ns, 'path');
  const bulbPath = `
        M ${cx - 7} ${cy + 2}
        Q ${cx - 9} ${cy - 6} ${cx - 6} ${cy - 12}
        Q ${cx} ${cy - 18} ${cx + 6} ${cy - 12}
        Q ${cx + 9} ${cy - 6} ${cx + 7} ${cy + 2}
        Z
    `;
  bulbGlass.setAttribute('d', bulbPath);
  bulbGlass.setAttribute('fill', glassColor);
  bulbGlass.setAttribute('stroke', isOn ? darkenColor(bulbColor) : '#666');
  bulbGlass.setAttribute('stroke-width', '1.5');
  if (isOn) {
    bulbGlass.setAttribute('filter', 'url(#glow)');
  }
  group.appendChild(bulbGlass);

  // Inner glow / filament area
  if (isOn) {
    const innerGlow = document.createElementNS(ns, 'ellipse');
    innerGlow.setAttribute('cx', String(cx));
    innerGlow.setAttribute('cy', String(cy - 6));
    innerGlow.setAttribute('rx', '4');
    innerGlow.setAttribute('ry', '5');
    innerGlow.setAttribute('fill', bulbColor);
    innerGlow.setAttribute('opacity', '0.8');
    group.appendChild(innerGlow);
  }

  // Filament (zigzag line)
  const filament = document.createElementNS(ns, 'path');
  const filamentPath = `
        M ${cx - 3} ${cy}
        L ${cx - 2} ${cy - 4}
        L ${cx} ${cy - 2}
        L ${cx + 2} ${cy - 5}
        L ${cx + 3} ${cy}
    `;
  filament.setAttribute('d', filamentPath);
  filament.setAttribute('fill', 'none');
  filament.setAttribute('stroke', filamentColor);
  filament.setAttribute('stroke-width', isOn ? '1.5' : '1');
  filament.setAttribute('stroke-linecap', 'round');
  group.appendChild(filament);

  // Screw base (brass/metal cap)
  const baseColor = '#8B7355';
  const baseHighlight = '#A08060';

  // Base neck
  const neck = document.createElementNS(ns, 'rect');
  neck.setAttribute('x', String(cx - 5));
  neck.setAttribute('y', String(cy + 1));
  neck.setAttribute('width', '10');
  neck.setAttribute('height', '4');
  neck.setAttribute('fill', '#2C2C2C');
  group.appendChild(neck);

  // Screw threads (3 ridges)
  for (let i = 0; i < 3; i++) {
    const thread = document.createElementNS(ns, 'rect');
    thread.setAttribute('x', String(cx - 6));
    thread.setAttribute('y', String(cy + 5 + i * 3));
    thread.setAttribute('width', '12');
    thread.setAttribute('height', '2');
    thread.setAttribute('fill', i % 2 === 0 ? baseColor : baseHighlight);
    thread.setAttribute('rx', '1');
    group.appendChild(thread);
  }

  // Bottom contact
  const contact = document.createElementNS(ns, 'rect');
  contact.setAttribute('x', String(cx - 3));
  contact.setAttribute('y', String(cy + 13));
  contact.setAttribute('width', '6');
  contact.setAttribute('height', '3');
  contact.setAttribute('fill', '#5A4A3A');
  contact.setAttribute('rx', '1');
  group.appendChild(contact);

  return group;
}

/**
 * Update light indicator bulbs in the UI
 */
export function updateLightIndicators(): void {
  const container = document.getElementById('light-indicators-container');
  if (!container) return;
  container.innerHTML = '';

  const roomLights = getRoomLights();
  const ns = 'http://www.w3.org/2000/svg';
  for (const [room, lights] of Object.entries(roomLights)) {
    if (lights.length === 0) continue;
    const pos = MAPPINGS.lightPositions[room as RoomName];
    if (!pos) continue;

    const roomGroup = document.createElementNS(ns, 'g');
    lights.forEach((light, i) => {
      const offsetX = (i - (lights.length - 1) / 2) * 28;
      const bulbGroup = createPixelBulb(ns, pos.x + offsetX, pos.y, light as LightInfoExtended);

      // Add tooltip
      const title = document.createElementNS(ns, 'title');
      title.textContent = `${light.name}: ${light.on ? 'ON' : 'OFF'} (click for color, double-click to toggle)`;
      bulbGroup.appendChild(title);

      // Single click opens color picker, double-click toggles
      bulbGroup.addEventListener('click', (e: MouseEvent) => {
        const colorPicker = getColorPicker();
        if (colorPicker) {
          colorPicker.handleBulbClick(light.id, light as LightInfoExtended, e);
        }
      });
      bulbGroup.addEventListener('dblclick', () => toggleLight(light.id, light.on));
      roomGroup.appendChild(bulbGroup);
    });
    container.appendChild(roomGroup);
  }
}

/**
 * Load lights from Hue Bridge and update UI
 */
export async function loadLights(): Promise<void> {
  try {
    const lights = await HueAPI.getAllLights();
    if (!lights) return;

    const previousLightStates = getPreviousLightStates();
    const newPreviousStates: Record<string, boolean> = { ...previousLightStates };

    // Initialize room lights structure
    const roomLights: RoomLights = {
      'Main Bedroom': [],
      'Guest Bedroom': [],
      Landing: [],
      'Home Office': [],
      Bathroom: [],
      Lounge: [],
      Hall: [],
      Extension: [],
      Kitchen: [],
      Outdoor: [],
    };

    for (const [id, light] of Object.entries(lights)) {
      const room = mapLightToRoom(light.name);
      if (room && roomLights[room]) {
        const currentState = light.state.on;
        if (
          previousLightStates[id] !== undefined &&
          previousLightStates[id] !== currentState &&
          light.state.reachable
        ) {
          // Emit event - let subscribers handle announcements
          getAppEvents()?.emit('light:changed', {
            room,
            lightId: id,
            lightName: light.name,
            on: currentState,
            reachable: light.state.reachable,
          });
        }
        newPreviousStates[id] = currentState;

        let color: string | null = null;
        if (light.state.on && light.state.colormode) {
          color = hueStateToColor(light.state);
        }

        roomLights[room].push({
          id,
          name: light.name,
          on: currentState,
          reachable: light.state.reachable,
          color,
          // Color picker needs these properties
          colormode: light.state.colormode,
          hue: light.state.hue,
          sat: light.state.sat,
          bri: light.state.bri,
          ct: light.state.ct,
        } as LightInfoExtended);
      }
    }

    // Update state
    const appState = getAppState();
    appState?.set('lights', roomLights);
    appState?.set('previousLightStates', newPreviousStates);

    updateLightIndicators();
    updateOutdoorLamppost();
  } catch (error) {
    Logger.error('Error loading lights:', error);
  }
}

/**
 * Lights module export
 */
export const Lights = {
  getRoomLights,
  getPreviousLightStates,
  loadLights,
  toggleLight,
  updateLightIndicators,
  createPixelBulb,
};

// Register with the service registry
Registry.register({
  key: 'Lights',
  instance: Lights,
});
