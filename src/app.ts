/**
 * Home Monitor Application
 * Main application logic for Hue sensor data, lights, and UI
 *
 * This module handles:
 * - Hue sensor/light data loading and processing
 * - Temperature and motion history management
 * - Thermometer and light indicator UI
 * - Voice announcements
 * - Sky/weather display
 *
 * Core infrastructure is provided by:
 * - src/core/connection-monitor.ts - Health checks
 * - src/core/poller.ts - Polling scheduler
 * - src/core/initializer.ts - App bootstrap
 *
 * Uses HueAPI from src/api/hue.ts for all Hue Bridge communication.
 */

import type {
  RoomName,
  RoomLights,
  LightInfo,
  MotionSensors,
  MotionHistoryEntry,
  TemperatureHistoryEntry,
  HueLightState,
  WeatherResponse,
  SunTimesResponse,
  MotionDetectedEvent,
  LightChangedEvent,
  ConnectionHueOnlineEvent,
  ConnectionProxyEvent,
  EventMeta,
} from './types';
import { Logger } from './utils/logger';
import {
  sensorMapping,
  roomNames,
  roomPositions,
  mapLightToRoom,
  mapMotionSensorToRoom,
  MAPPINGS,
} from './config/mappings';
import { APP_CONFIG } from './config/constants';
import { AppState } from './core/state';
import { AppEvents } from './core/events';
import { Poller } from './core/poller';
import { ConnectionMonitor } from './core/connection-monitor';
import { AppInitializer } from './core/initializer';
import { HueAPI } from './api/hue';
import { createDraggable, loadSavedPosition } from './ui/draggable';

// =============================================================================
// WINDOW DECLARATIONS
// =============================================================================

declare const window: Window & {
  WEATHER_CONFIG?: { API_KEY: string; LOCATION?: string };
  TapoControls?: { init: () => Promise<void> };
  ColorPicker?: { handleBulbClick: (id: string, light: LightInfoExtended, e: MouseEvent) => void };
  HomeMonitor?: typeof HomeMonitor;
  toggleSection?: typeof toggleSection;
};

// Extended light info with color picker properties
interface LightInfoExtended extends LightInfo {
  colormode?: 'hs' | 'ct' | 'xy';
  hue?: number;
  sat?: number;
  bri?: number;
  ct?: number;
}

// =============================================================================
// STATE
// =============================================================================

// Local variables for non-shared state
let sunriseTime: Date | null = null;
let sunsetTime: Date | null = null;

// Helper functions to access AppState
function getRoomLights(): RoomLights {
  return AppState.get<RoomLights>('lights') ?? {
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
}

function getMotionSensors(): MotionSensors {
  return AppState.get<MotionSensors>('motion') ?? {};
}

function getTempHistory(): Record<string, TemperatureHistoryEntry[]> {
  return AppState.get<Record<string, TemperatureHistoryEntry[]>>('tempHistory') ?? {};
}

function getMotionHistory(): MotionHistoryEntry[] {
  return AppState.get<MotionHistoryEntry[]>('motionHistory') ?? [];
}

function getPreviousLightStates(): Record<string, boolean> {
  return AppState.get<Record<string, boolean>>('previousLightStates') ?? {};
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getTemperatureColor(temp: number): string {
  if (temp < 10) return '#4169E1';
  if (temp < 15) return '#00CED1';
  if (temp < 20) return '#32CD32';
  if (temp < 25) return '#FFA500';
  return '#FF4500';
}

function hueStateToColor(state: HueLightState): string {
  if (state.colormode === 'hs' && state.hue !== undefined && state.sat !== undefined && state.bri !== undefined) {
    const h = (state.hue / 65535) * 360;
    const s = state.sat / 254;
    const v = state.bri / 254;
    return hsvToHex(h, s, v);
  } else if (state.colormode === 'ct' && state.ct !== undefined) {
    const ct = state.ct;
    if (ct < 250) return '#E0EFFF';
    if (ct < 350) return '#FFF5E0';
    return '#FFE4C4';
  } else if (state.colormode === 'xy' && state.xy && state.bri !== undefined) {
    return xyToHex(state.xy[0], state.xy[1], state.bri);
  }
  return '#FFD700';
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r: number, g: number, b: number;
  if (h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }
  const toHex = (n: number): string =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function xyToHex(x: number, y: number, bri: number): string {
  const z = 1 - x - y;
  const Y = bri / 254;
  const X = (Y / y) * x;
  const Z = (Y / y) * z;
  let r = X * 1.656492 - Y * 0.354851 - Z * 0.255038;
  let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
  let b = X * 0.051713 - Y * 0.121364 + Z * 1.01153;
  const gamma = (n: number): number =>
    n <= 0.0031308 ? 12.92 * n : 1.055 * Math.pow(n, 1 / 2.4) - 0.055;
  r = Math.max(0, Math.min(1, gamma(r)));
  g = Math.max(0, Math.min(1, gamma(g)));
  b = Math.max(0, Math.min(1, gamma(b)));
  const toHex = (n: number): string =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function darkenColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const factor = 0.7;
  const toHex = (n: number): string =>
    Math.round(n * factor)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// =============================================================================
// HISTORY MANAGEMENT
// =============================================================================

function initTempHistory(): void {
  // AppState handles loading from localStorage automatically
  // Just clean up old entries
  const tempHistory = getTempHistory();
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;
  const cleaned: Record<string, TemperatureHistoryEntry[]> = {};
  for (const room in tempHistory) {
    cleaned[room] = tempHistory[room].filter((entry) => entry.time > cutoff);
  }
  AppState.set('tempHistory', cleaned);
}

function saveTempData(room: string, temp: string): void {
  const now = Date.now();
  const tempHistory = getTempHistory();
  if (!tempHistory[room]) tempHistory[room] = [];
  tempHistory[room].push({ time: now, temp: parseFloat(temp) });
  const cutoff = now - 24 * 60 * 60 * 1000;
  tempHistory[room] = tempHistory[room].filter((entry) => entry.time > cutoff);
  AppState.set('tempHistory', tempHistory);
}

function initMotionHistory(): void {
  // AppState handles loading from localStorage automatically
  // Just clean up old entries
  const motionHistory = getMotionHistory();
  const now = Date.now();
  const cutoff = now - 48 * 60 * 60 * 1000;
  const cleaned = motionHistory.filter((entry) => entry.time > cutoff);
  AppState.set('motionHistory', cleaned);
  updateMotionLogDisplay();
}

function logMotionEvent(room: string): void {
  const now = Date.now();
  const motionHistory = getMotionHistory();
  motionHistory.push({ type: 'motion', location: room, room: room, time: now });
  const cutoff = now - 48 * 60 * 60 * 1000;
  const cleaned = motionHistory.filter((entry) => entry.time > cutoff);
  AppState.set('motionHistory', cleaned);
  updateMotionLogDisplay();
}

function updateMotionLogDisplay(): void {
  const logContainer = document.getElementById('motion-log');
  const countDisplay = document.getElementById('motion-log-count');
  if (!logContainer) return;

  const motionHistory = getMotionHistory();

  if (countDisplay) countDisplay.textContent = String(motionHistory.length);

  if (motionHistory.length === 0) {
    logContainer.innerHTML =
      '<div style="text-align: center; color: #888; padding: 20px;">No motion events recorded yet</div>';
    return;
  }

  const sortedHistory = [...motionHistory].sort((a, b) => b.time - a.time);
  const groupedByDate: Record<string, MotionHistoryEntry[]> = {};
  sortedHistory.forEach((entry) => {
    const date = new Date(entry.time);
    const dateKey = date.toLocaleDateString();
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(entry);
  });

  let html = '';
  for (const [dateKey, events] of Object.entries(groupedByDate)) {
    html += `<div style="margin-bottom: 15px;"><div style="font-weight: bold; margin-bottom: 8px;">\u{1F4C5} ${dateKey}</div>`;
    events.forEach((entry) => {
      const date = new Date(entry.time);
      const timeStr = date.toLocaleTimeString();
      const roomEmoji: Record<string, string> = {
        Outdoor: '\u{1F333}',
        Hall: '\u{1F6AA}',
        Landing: '\u{1FA9C}',
        Bathroom: '\u{1F6BF}',
      };
      const emoji = roomEmoji[entry.room] || '\u{1F6B6}';
      html += `<div style="padding: 6px 10px; margin: 4px 0; background: rgba(0,0,0,0.1); border-radius: 6px; border-left: 3px solid #FF6B35;">`;
      html += `${emoji} <strong>${entry.room}</strong> - ${timeStr}</div>`;
    });
    html += '</div>';
  }
  logContainer.innerHTML = html;
}

// =============================================================================
// VOICE ANNOUNCEMENTS
// =============================================================================

function announceMotion(room: string): void {
  if (!('speechSynthesis' in window)) return;
  const messages: Record<string, string> = {
    Outdoor: 'Motion detected outside',
    Hall: 'Motion detected in the hall',
    Landing: 'Motion detected on the landing',
    Bathroom: 'Motion detected in the bathroom',
  };
  const utterance = new SpeechSynthesisUtterance();
  utterance.text = messages[room] || `Motion detected in ${room}`;
  utterance.rate = 1.1;
  utterance.volume = 1.0;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function announceLight(room: string, isOn: boolean): void {
  if (AppState.get<boolean>('effect.inProgress')) return;
  if (!('speechSynthesis' in window)) return;
  const utterance = new SpeechSynthesisUtterance();
  utterance.text = `${room} light turned ${isOn ? 'on' : 'off'}`;
  utterance.rate = 1.0;
  utterance.volume = 0.8;
  window.speechSynthesis.speak(utterance);
}

// =============================================================================
// THERMOMETER UI
// =============================================================================

function createThermometer(
  elementId: string,
  temp: number,
  _roomName: string
): SVGTextElement | null {
  const position = roomPositions[elementId];
  if (!position) return null;

  const ns = 'http://www.w3.org/2000/svg';
  const group = document.createElementNS(ns, 'g');
  group.setAttribute('class', 'thermometer pixel-thermometer');
  group.setAttribute('data-room', elementId);

  // Compact pixel-art dimensions
  const tubeWidth = 14;
  const tubeHeight = 45;
  const bulbRadius = 9;
  const frameWidth = tubeWidth + 8;
  const totalHeight = tubeHeight + bulbRadius * 2;

  // Colors
  const mercuryColor = position.isOutdoor ? '#3498DB' : getTemperatureColor(temp);
  const frameColor = '#8B7355';
  const frameHighlight = '#A08060';
  const frameShadow = '#5A4A3A';

  // Wooden/brass frame backing
  const frameBg = document.createElementNS(ns, 'rect');
  frameBg.setAttribute('x', '-4');
  frameBg.setAttribute('y', '-6');
  frameBg.setAttribute('width', String(frameWidth));
  frameBg.setAttribute('height', String(totalHeight + 8));
  frameBg.setAttribute('rx', '3');
  frameBg.setAttribute('fill', frameColor);
  frameBg.setAttribute('stroke', frameShadow);
  frameBg.setAttribute('stroke-width', '1.5');
  group.appendChild(frameBg);

  // Frame highlight (left edge)
  const frameHL = document.createElementNS(ns, 'rect');
  frameHL.setAttribute('x', '-3');
  frameHL.setAttribute('y', '-5');
  frameHL.setAttribute('width', '2');
  frameHL.setAttribute('height', String(totalHeight + 6));
  frameHL.setAttribute('rx', '1');
  frameHL.setAttribute('fill', frameHighlight);
  frameHL.setAttribute('opacity', '0.6');
  group.appendChild(frameHL);

  // Glass tube background
  const tube = document.createElementNS(ns, 'rect');
  tube.setAttribute('x', '1');
  tube.setAttribute('y', '0');
  tube.setAttribute('width', String(tubeWidth - 2));
  tube.setAttribute('height', String(tubeHeight));
  tube.setAttribute('rx', '6');
  tube.setAttribute('fill', '#F5F5F0');
  tube.setAttribute('stroke', '#C8C0B0');
  tube.setAttribute('stroke-width', '1');
  group.appendChild(tube);

  // Bulb background
  const bulb = document.createElementNS(ns, 'circle');
  bulb.setAttribute('cx', String(tubeWidth / 2));
  bulb.setAttribute('cy', String(tubeHeight + bulbRadius - 2));
  bulb.setAttribute('r', String(bulbRadius));
  bulb.setAttribute('fill', '#F5F5F0');
  bulb.setAttribute('stroke', '#C8C0B0');
  bulb.setAttribute('stroke-width', '1');
  group.appendChild(bulb);

  // Mercury level (0-30C range)
  const percentage = Math.max(0, Math.min(1, temp / 30));
  const mercuryHeight = (tubeHeight - 8) * percentage + bulbRadius;

  // Mercury in bulb
  const mercuryBulb = document.createElementNS(ns, 'circle');
  mercuryBulb.setAttribute('cx', String(tubeWidth / 2));
  mercuryBulb.setAttribute('cy', String(tubeHeight + bulbRadius - 2));
  mercuryBulb.setAttribute('r', String(bulbRadius - 3));
  mercuryBulb.setAttribute('fill', mercuryColor);
  mercuryBulb.setAttribute('class', 'mercury-fill');
  group.appendChild(mercuryBulb);

  // Mercury in tube
  const mercuryTube = document.createElementNS(ns, 'rect');
  mercuryTube.setAttribute('x', String(tubeWidth / 2 - 2.5));
  mercuryTube.setAttribute('y', String(tubeHeight - mercuryHeight + bulbRadius));
  mercuryTube.setAttribute('width', '5');
  mercuryTube.setAttribute('height', String(Math.max(0, mercuryHeight - bulbRadius + 2)));
  mercuryTube.setAttribute('rx', '2.5');
  mercuryTube.setAttribute('fill', mercuryColor);
  mercuryTube.setAttribute('class', 'mercury-fill');
  group.appendChild(mercuryTube);

  // Scale markings (3 marks)
  for (let i = 0; i <= 2; i++) {
    const y = tubeHeight - ((tubeHeight - 8) * i) / 2 + 4;
    const mark = document.createElementNS(ns, 'line');
    mark.setAttribute('x1', String(tubeWidth - 1));
    mark.setAttribute('y1', String(y));
    mark.setAttribute('x2', String(tubeWidth + 2));
    mark.setAttribute('y2', String(y));
    mark.setAttribute('stroke', frameShadow);
    mark.setAttribute('stroke-width', '1');
    group.appendChild(mark);
  }

  // Temperature text (prominent, easy to read)
  const tempText = document.createElementNS(ns, 'text');
  tempText.setAttribute('x', String(tubeWidth / 2));
  tempText.setAttribute('y', String(totalHeight + 16));
  tempText.setAttribute('text-anchor', 'middle');
  tempText.setAttribute('font-size', '14');
  tempText.setAttribute('font-weight', '700');
  tempText.setAttribute('font-family', "'Fredoka', sans-serif");
  tempText.setAttribute('fill', mercuryColor);
  tempText.setAttribute('stroke', '#FFF');
  tempText.setAttribute('stroke-width', '2.5');
  tempText.setAttribute('paint-order', 'stroke fill');
  tempText.setAttribute('id', elementId);
  tempText.textContent = temp.toFixed(1) + '\u00B0';
  group.appendChild(tempText);

  group.setAttribute('transform', `translate(${position.x}, ${position.y})`);

  const containerId = position.isOutdoor
    ? 'outdoor-thermometer-container'
    : 'thermometers-container';
  const container = document.getElementById(containerId);
  if (container) container.appendChild(group);

  // Make thermometer draggable
  const storageKey = `thermometer-${elementId}`;
  loadSavedPosition(group, storageKey);
  createDraggable(group, { storageKey: storageKey });

  return tempText;
}

function createSparkles(element: Element | null): void {
  if (!element) return;
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  for (let i = 0; i < 8; i++) {
    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle-star';
    sparkle.textContent = ['\u2728', '\u2B50', '\u{1F31F}', '\u{1F4AB}'][Math.floor(Math.random() * 4)];
    const angle = (Math.PI * 2 * i) / 8;
    const distance = 50 + Math.random() * 30;
    sparkle.style.left = centerX + 'px';
    sparkle.style.top = centerY + 'px';
    sparkle.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
    sparkle.style.setProperty('--ty', Math.sin(angle) * distance + 'px');
    document.body.appendChild(sparkle);
    setTimeout(() => sparkle.remove(), 1000);
  }
}

// =============================================================================
// DATA LOADING
// =============================================================================

async function loadTemperatures(showSparkles = true): Promise<void> {
  try {
    const sensors = await HueAPI.getAllSensors();
    if (!sensors) throw new Error('Failed to fetch sensors');

    const thermometersContainer = document.getElementById('thermometers-container');
    const outdoorContainer = document.getElementById('outdoor-thermometer-container');
    if (thermometersContainer) thermometersContainer.innerHTML = '';
    if (outdoorContainer) outdoorContainer.innerHTML = '';

    interface TemperatureReading {
      sensorId: string;
      room: string;
      temp: number;
      lastUpdated: string;
    }

    const temperatureReadings: TemperatureReading[] = [];
    for (const [id, sensor] of Object.entries(sensors)) {
      if (sensor.type === 'ZLLTemperature') {
        const elementId = sensorMapping[sensor.name];
        if (elementId && sensor.state.temperature != null) {
          const tempC = (sensor.state.temperature / 100.0).toFixed(1);
          const roomName = roomNames[sensor.name] || sensor.name;
          const tempElement = createThermometer(elementId, parseFloat(tempC), roomName);
          saveTempData(sensor.name, tempC);

          // Collect for event
          temperatureReadings.push({
            sensorId: id,
            room: roomName,
            temp: parseFloat(tempC),
            lastUpdated: sensor.state.lastupdated,
          });

          if (tempElement && showSparkles) {
            setTimeout(() => createSparkles(tempElement), 100);
          }
        }
      }
    }

    // Emit temperature batch update event
    if (temperatureReadings.length > 0) {
      AppEvents.emit('temperature:updated', {
        readings: temperatureReadings,
        timestamp: Date.now(),
      });
    }

    const lastUpdateEl = document.getElementById('lastUpdate');
    if (lastUpdateEl) {
      lastUpdateEl.textContent = `Last updated: ${new Date().toLocaleString()} \u2728`;
    }
  } catch (error) {
    Logger.error('Error loading temperatures:', error);
  }
}

async function loadLights(): Promise<void> {
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
          AppEvents.emit('light:changed', {
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
    AppState.set('lights', roomLights);
    AppState.set('previousLightStates', newPreviousStates);

    updateLightIndicators();
    updateOutdoorLamppost();
  } catch (error) {
    Logger.error('Error loading lights:', error);
  }
}

async function loadMotionSensors(): Promise<void> {
  try {
    const sensors = await HueAPI.getAllSensors();
    if (!sensors) return;

    const motionSensors = getMotionSensors();
    const updatedMotion: MotionSensors = { ...motionSensors };

    for (const [id, sensor] of Object.entries(sensors)) {
      if (sensor.type === 'ZLLPresence') {
        const room = mapMotionSensorToRoom(sensor.name);
        if (room && updatedMotion[room]) {
          const wasDetected = updatedMotion[room].detected;
          updatedMotion[room] = {
            ...updatedMotion[room],
            detected: sensor.state.presence ?? false,
            lastUpdated: new Date(),
          };

          if (sensor.state.presence && !wasDetected) {
            logMotionEvent(room);

            // Emit event - let subscribers handle announcements and indicators
            AppEvents.emit('motion:detected', {
              room,
              sensorId: id,
              sensorName: sensor.name,
              timestamp: Date.now(),
            });
          }
        }
      }
    }

    AppState.set('motion', updatedMotion);
  } catch (error) {
    Logger.error('Error loading motion sensors:', error);
  }
}

// =============================================================================
// LIGHT UI
// =============================================================================

function updateLightIndicators(): void {
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
        if (window.ColorPicker) {
          window.ColorPicker.handleBulbClick(light.id, light as LightInfoExtended, e);
        }
      });
      bulbGroup.addEventListener('dblclick', () => toggleLight(light.id, light.on));
      roomGroup.appendChild(bulbGroup);
    });
    container.appendChild(roomGroup);
  }
}

/**
 * Creates a pixel-art style Edison light bulb
 * Matches the cozy UK home aesthetic
 */
function createPixelBulb(
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

function updateOutdoorLamppost(): void {
  const roomLights = getRoomLights();
  const outdoorLights = roomLights['Outdoor'] || [];
  const outdoorLightsOn = outdoorLights.some((l) => l.on);

  const bulb = document.getElementById('lamp-bulb');
  const glow = document.getElementById('lamp-glow');
  const housing = document.getElementById('lamp-housing');

  if (!bulb) return;

  if (outdoorLightsOn) {
    // Bulb on - warm glow
    bulb.setAttribute('fill', '#FFD700');
    bulb.setAttribute('filter', 'url(#glow)');

    // Glass panels glow warm
    if (housing) {
      const panels = housing.querySelector('rect[opacity]');
      if (panels) {
        panels.setAttribute('fill', '#FFE4B5');
        panels.setAttribute('opacity', '0.7');
      }
    }

    // Outer glow visible
    if (glow) {
      const animate = glow.querySelector('animate');
      if (animate) animate.setAttribute('values', '0.3;0.5;0.3');
    }
  } else {
    // Bulb off
    bulb.setAttribute('fill', '#666');
    bulb.removeAttribute('filter');

    // Glass panels dark
    if (housing) {
      const panels = housing.querySelector('rect[opacity]');
      if (panels) {
        panels.setAttribute('fill', '#1E3A3A');
        panels.setAttribute('opacity', '0.4');
      }
    }

    // No outer glow
    if (glow) {
      const animate = glow.querySelector('animate');
      if (animate) animate.setAttribute('values', '0;0');
    }
  }
}

function initLamppostDraggable(): void {
  const lamppost = document.getElementById('outdoor-lamppost');
  if (lamppost) {
    const storageKey = 'lamppost-position';
    loadSavedPosition(lamppost, storageKey);
    createDraggable(lamppost, { storageKey: storageKey });
  }
}

function initWheelieBinDraggable(): void {
  const bin = document.getElementById('wheelie-bin');
  if (bin) {
    const storageKey = 'wheelie-bin-position';
    loadSavedPosition(bin, storageKey);
    createDraggable(bin, { storageKey: storageKey });
  }
}

async function toggleLight(lightId: string, currentState: boolean): Promise<void> {
  try {
    const success = await HueAPI.setLightState(lightId, { on: !currentState });
    if (success) setTimeout(loadLights, 500);
  } catch (error) {
    Logger.error('Error toggling light:', error);
  }
}

// =============================================================================
// SKY & WEATHER
// =============================================================================

async function fetchSunTimes(): Promise<void> {
  try {
    const response = await fetch(
      'https://api.sunrise-sunset.org/json?lat=51.7356&lng=0.4685&formatted=0'
    );
    const data = (await response.json()) as SunTimesResponse;
    if (data.status === 'OK') {
      sunriseTime = new Date(data.results.sunrise);
      sunsetTime = new Date(data.results.sunset);
      Logger.info(
        `Sunrise: ${sunriseTime.toLocaleTimeString()}, Sunset: ${sunsetTime.toLocaleTimeString()}`
      );
      updateSky();
    }
  } catch (error) {
    Logger.error('Error fetching sun times:', error);
    const now = new Date();
    sunriseTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0);
    sunsetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0);
  }
}

function updateSky(): void {
  const skyGradient = document.getElementById('skyGradient');
  const sun = document.getElementById('sun');
  const moon = document.getElementById('moon');
  const stars = document.getElementById('stars');
  if (!skyGradient) return;

  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const now = new Date();

  if (!sunriseTime || !sunsetTime) {
    sunriseTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0);
    sunsetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0);
  }

  interface SkyConfig {
    c1: string;
    c2: string;
    sun: boolean;
    moon: boolean;
    stars: boolean;
  }

  let config: SkyConfig;
  if (isDarkMode || now < sunriseTime || now > sunsetTime) {
    config = { c1: '#0B1026', c2: '#1E3A5F', sun: false, moon: true, stars: true };
  } else {
    config = { c1: '#87CEEB', c2: '#E0F6FF', sun: true, moon: false, stars: false };
  }

  const stops = skyGradient.getElementsByTagName('stop');
  if (stops.length >= 2) {
    stops[0].setAttribute('style', `stop-color:${config.c1};stop-opacity:1`);
    stops[1].setAttribute('style', `stop-color:${config.c2};stop-opacity:1`);
  }

  if (sun) (sun as HTMLElement).style.display = config.sun ? 'block' : 'none';
  if (moon) (moon as HTMLElement).style.display = config.moon ? 'block' : 'none';
  if (stars) (stars as HTMLElement).style.display = config.stars ? 'block' : 'none';
}

async function updateWeatherDisplay(): Promise<void> {
  const apiKey = window.WEATHER_CONFIG?.API_KEY;
  if (!apiKey || apiKey === 'YOUR-WEATHERAPI-KEY-HERE') return;

  try {
    const response = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=Chelmsford,UK`
    );
    if (!response.ok) return;
    const data = (await response.json()) as WeatherResponse;

    const els: Record<string, string> = {
      'weather-temp-svg': `${Math.round(data.current.temp_c)}\u00B0`,
      'weather-condition-svg': data.current.condition.text,
      'weather-humidity-svg': `${data.current.humidity}%`,
      'weather-uv-svg': `UV ${data.current.uv}`,
    };

    for (const [id, val] of Object.entries(els)) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    }

    Logger.info(`Weather: ${data.current.temp_c}\u00B0C, ${data.current.condition.text}`);
  } catch (error) {
    Logger.error('Error fetching weather:', error);
  }
}

// =============================================================================
// EVENT SUBSCRIPTIONS
// =============================================================================

/**
 * Setup event subscriptions to decouple data loading from side effects
 * This allows features to react to events without direct coupling
 *
 * Note: MotionIndicators now subscribes to motion:detected internally,
 * so we only handle voice announcements here.
 */
function setupEventSubscriptions(): void {
  // Motion detection -> voice announcement
  // (MotionIndicators handles its own subscription for visual indicators)
  AppEvents.on<MotionDetectedEvent>('motion:detected', (data) => {
    announceMotion(data.room);
  });

  // Light state change -> voice announcement
  AppEvents.on<LightChangedEvent>('light:changed', (data) => {
    announceLight(data.room, data.on);
  });

  // Connection status changes -> logging
  AppEvents.on<ConnectionHueOnlineEvent>('connection:hue:online', (data) => {
    Logger.success(`Hue Bridge connected: ${data.name}`);
  });

  AppEvents.on('connection:hue:offline', () => {
    Logger.warn('Hue Bridge disconnected');
  });

  AppEvents.on<ConnectionProxyEvent>('connection:proxy:online', (data) => {
    Logger.success(`${data.proxy} proxy connected`);
  });

  AppEvents.on<ConnectionProxyEvent>('connection:proxy:offline', (data) => {
    Logger.warn(`${data.proxy} proxy disconnected`);
  });

  // Debug: log all events in debug mode
  if (APP_CONFIG.debug) {
    AppEvents.on('*', (data: unknown, meta: EventMeta) => {
      Logger.debug(`Event: ${meta.event}`, data);
    });
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

async function init(): Promise<void> {
  Logger.info('Initializing Home Monitor...');

  // Setup event subscriptions (decouple data loading from side effects)
  setupEventSubscriptions();

  // Initialize configuration
  await AppInitializer.initConfiguration();

  // Initialize history
  initTempHistory();
  initMotionHistory();

  // Load Hue data immediately (direct connection, no proxy needed)
  Logger.info('Loading Hue data...');
  const hueDataPromise = Promise.all([loadTemperatures(), loadLights(), loadMotionSensors()]);

  // Check proxy connections in parallel (faster startup)
  const proxyCheckPromise = ConnectionMonitor.waitForConnections({
    maxAttempts: 3,
    retryInterval: 500,
    timeout: 5000,
  });

  // Wait for Hue data (critical) - proxies can finish in background
  await hueDataPromise;

  // Initialize Tapo once proxy check completes
  proxyCheckPromise.then(async () => {
    if (typeof window.TapoControls !== 'undefined' && window.TapoControls?.init) {
      if (ConnectionMonitor.isOnline('tapo')) {
        Logger.info('Initializing Tapo controls...');
        await window.TapoControls.init();
      } else {
        Logger.warn('Tapo proxy offline, skipping Tapo initialization');
      }
    }
  });

  // Fetch external data
  fetchSunTimes();
  updateWeatherDisplay();

  // Setup UI handlers
  AppInitializer.setupDraggables();
  AppInitializer.setupLamppostHandler(toggleLight, (room: string) => {
    const lights = getRoomLights();
    return lights[room as RoomName];
  });
  initLamppostDraggable();
  initWheelieBinDraggable();

  // Register polling tasks using the Poller module
  Poller.register(
    'connectionStatus',
    async () => { await ConnectionMonitor.checkAll(); },
    APP_CONFIG.intervals.connectionStatus || 30000
  );
  Poller.register('motionSensors', loadMotionSensors, APP_CONFIG.intervals.motionSensors);
  Poller.register('lights', loadLights, APP_CONFIG.intervals.lights);
  Poller.register('temperatures', () => loadTemperatures(false), APP_CONFIG.intervals.temperatures);
  Poller.register('motionLog', updateMotionLogDisplay, APP_CONFIG.intervals.motionLog);
  Poller.register('sky', updateSky, APP_CONFIG.intervals.sky);
  Poller.register('sunTimes', fetchSunTimes, APP_CONFIG.intervals.sunTimes);
  Poller.register('weather', updateWeatherDisplay, APP_CONFIG.intervals.weather);

  // Start all polling
  Poller.startAll();

  Logger.success('Home Monitor initialized!');

  // Emit app ready event
  // Note: MooseSystem subscribes to this event and auto-initializes
  AppEvents.emit('app:ready', {
    timestamp: Date.now(),
    features: {
      hue: ConnectionMonitor.isOnline('hue'),
      sonos: ConnectionMonitor.isOnline('sonos'),
      tapo: ConnectionMonitor.isOnline('tapo'),
      shield: ConnectionMonitor.isOnline('shield'),
    },
  });
}

// =============================================================================
// COLLAPSIBLE SECTIONS
// =============================================================================

/**
 * Toggle a collapsible section (Sensor Details, Activity Log, etc.)
 * @param contentId - ID of the content element to toggle
 * @param arrowId - ID of the arrow indicator element
 */
function toggleSection(contentId: string, arrowId: string): void {
  const content = document.getElementById(contentId);
  const arrow = document.getElementById(arrowId);

  if (content && arrow) {
    content.classList.toggle('collapsed');
    arrow.classList.toggle('collapsed');
  }
}

// Expose toggleSection globally for onclick handlers
if (typeof window !== 'undefined') {
  window.toggleSection = toggleSection;
}

// =============================================================================
// EXPOSE MODULE
// =============================================================================

export const HomeMonitor = {
  init,
  loadTemperatures,
  loadLights,
  loadMotionSensors,
  updateWeatherDisplay,
  toggleLight,
  getRoomLights: (room?: string): RoomLights | LightInfo[] | undefined => {
    const lights = getRoomLights();
    return room ? lights[room as RoomName] : lights;
  },
  getMotionSensors,
} as const;

// Expose on window for global access
if (typeof window !== 'undefined') {
  window.HomeMonitor = HomeMonitor;
}

// Auto-initialize
AppInitializer.onReady(init);
