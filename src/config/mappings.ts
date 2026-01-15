/**
 * House Mappings Configuration
 * Single source of truth for all sensor, room, and light mappings
 */

import type { RoomName, RoomPosition } from '../types';
import { Registry } from '../core/registry';

// Temperature sensor name to DOM element ID mapping
export const sensorMapping: Record<string, string> = {
  landing: 'temp-landing',
  'main bedroom': 'temp-main-bedroom',
  'guest room': 'temp-guest-bedroom',
  'Hue temperature sensor 1': 'temp-office',
  bathroom: 'temp-bathroom',
  Hall: 'temp-hall',
  lounge: 'temp-lounge',
  ExtensionDimmer: 'temp-extension',
  KitchenSensor: 'temp-kitchen',
  'Hue outdoor temp. sensor 1': 'temp-outdoor',
};

// Sensor name to display room name mapping
export const roomNames: Record<string, string> = {
  landing: 'Landing',
  'main bedroom': 'Main Bedroom',
  'guest room': 'Guest Bedroom',
  'Hue temperature sensor 1': 'Home Office',
  bathroom: 'Bathroom',
  Hall: 'Hall',
  lounge: 'Lounge',
  ExtensionDimmer: 'Extension',
  KitchenSensor: 'Kitchen',
  'Hue outdoor temp. sensor 1': 'Outdoor',
};

// Room colors for UI elements
export const roomColors: Record<string, string> = {
  landing: '#FF6B9D',
  'main bedroom': '#FFB6C1',
  'guest room': '#DDA0DD',
  'Hue temperature sensor 1': '#87CEEB',
  bathroom: '#4ECDC4',
  Hall: '#95E1D3',
  lounge: '#F4A460',
  ExtensionDimmer: '#98D8C8',
  KitchenSensor: '#FFB347',
  'Hue outdoor temp. sensor 1': '#7AE582',
};

// Thermometer SVG positions
export const roomPositions: Record<string, RoomPosition> = {
  'temp-main-bedroom': { x: 180, y: 220 },
  'temp-landing': { x: 340, y: 220 },
  'temp-office': { x: 500, y: 220 },
  'temp-bathroom': { x: 660, y: 220 },
  'temp-guest-bedroom': { x: 820, y: 220 },
  'temp-hall': { x: 200, y: 460 },
  'temp-lounge': { x: 400, y: 460 },
  'temp-kitchen': { x: 600, y: 460 },
  'temp-extension': { x: 800, y: 460 },
  'temp-outdoor': { x: 60, y: 10, isOutdoor: true },
};

// Light name patterns to room mapping (regex patterns)
export const lightMappings: Record<string, RoomName> = {
  'outdoor|outside|garden': 'Outdoor',
  guest: 'Guest Bedroom',
  'main bedroom|mainbedroom|^bedroomlight$|^bedroom$': 'Main Bedroom',
  landing: 'Landing',
  office: 'Home Office',
  'bathroom|bath': 'Bathroom',
  lounge: 'Lounge',
  hall: 'Hall',
  extension: 'Extension',
  kitchen: 'Kitchen',
};

// Motion sensor name patterns to room mapping (regex patterns)
export const motionSensorMappings: Record<string, string> = {
  'outdoor|outside|garden': 'Outdoor',
  'hall|frontdoor|front door': 'Hall',
  landing: 'Landing',
  'bathroom|bath': 'Bathroom',
};

// Light indicator positions on house SVG
export const lightPositions: Partial<Record<RoomName, { x: number; y: number }>> = {
  'Main Bedroom': { x: 180, y: 240 },
  Landing: { x: 340, y: 240 },
  'Home Office': { x: 500, y: 240 },
  Bathroom: { x: 660, y: 240 },
  'Guest Bedroom': { x: 820, y: 240 },
  Hall: { x: 200, y: 405 },
  Lounge: { x: 400, y: 405 },
  Kitchen: { x: 600, y: 405 },
  Extension: { x: 800, y: 405 },
};

// List of all rooms
export const rooms: RoomName[] = [
  'Main Bedroom',
  'Guest Bedroom',
  'Bathroom',
  'Landing',
  'Hall',
  'Home Office',
  'Lounge',
  'Kitchen',
  'Extension',
  'Outdoor',
];

/**
 * Map a light name to a room using pattern matching
 */
export function mapLightToRoom(lightName: string): RoomName | null {
  if (!lightName) return null;
  const nameLower = lightName.toLowerCase();
  for (const [pattern, room] of Object.entries(lightMappings)) {
    if (new RegExp(pattern, 'i').test(nameLower)) return room;
  }
  return null;
}

/**
 * Map a motion sensor name to a room using pattern matching
 */
export function mapMotionSensorToRoom(sensorName: string): string | null {
  if (!sensorName) return null;
  const nameLower = sensorName.toLowerCase();
  for (const [pattern, room] of Object.entries(motionSensorMappings)) {
    if (new RegExp(pattern, 'i').test(nameLower)) return room;
  }
  return null;
}

// Combined exports object
export const MAPPINGS = {
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
} as const;

// Register with the service registry
Registry.register({
  key: 'MAPPINGS',
  instance: MAPPINGS,
});
