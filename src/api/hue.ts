/**
 * Philips Hue Bridge API Module
 * Handles all communication with the Hue Bridge
 */

import type {
  HueLightsResponse,
  HueSensorsResponse,
  HueLightState,
  HueBridgeConfig,
  HueBridgeDiscovery,
} from '../types';
import { Logger } from '../utils/logger';
import { Registry } from '../core/registry';

interface BridgeConfig {
  ip: string;
  username: string;
}

/**
 * Get bridge configuration from Registry or window fallback
 */
function getBridgeConfig(): BridgeConfig {
  const config = Registry.getOptional('HUE_CONFIG');
  return {
    ip: config?.BRIDGE_IP ?? '192.168.68.51',
    username: config?.USERNAME ?? '',
  };
}

/**
 * Get the base URL for API calls
 */
function getBaseUrl(): string {
  const config = getBridgeConfig();
  return `http://${config.ip}/api/${config.username}`;
}

/**
 * Fetch all lights from the bridge
 */
async function getAllLights(): Promise<HueLightsResponse | null> {
  try {
    const response = await fetch(`${getBaseUrl()}/lights`);
    if (!response.ok) return null;
    return (await response.json()) as HueLightsResponse;
  } catch (error) {
    Logger.error('Error getting lights:', error);
    return null;
  }
}

/**
 * Get a specific light
 */
async function getLight(lightId: string): Promise<HueLightsResponse[string] | null> {
  try {
    const response = await fetch(`${getBaseUrl()}/lights/${lightId}`);
    if (!response.ok) return null;
    return (await response.json()) as HueLightsResponse[string];
  } catch (error) {
    Logger.error(`Error getting light ${lightId}:`, error);
    return null;
  }
}

/**
 * Set light state
 */
async function setLightState(
  lightId: string,
  state: Partial<HueLightState>
): Promise<boolean> {
  try {
    const response = await fetch(`${getBaseUrl()}/lights/${lightId}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    return response.ok;
  } catch (error) {
    Logger.error(`Error setting light ${lightId}:`, error);
    return false;
  }
}

/**
 * Toggle a light on/off
 */
async function toggleLight(lightId: string, currentState: boolean): Promise<boolean> {
  return await setLightState(lightId, { on: !currentState });
}

/**
 * Fetch all sensors from the bridge
 */
async function getAllSensors(): Promise<HueSensorsResponse | null> {
  try {
    const response = await fetch(`${getBaseUrl()}/sensors`);
    if (!response.ok) return null;
    return (await response.json()) as HueSensorsResponse;
  } catch (error) {
    Logger.error('Error getting sensors:', error);
    return null;
  }
}

interface TemperatureSensorData {
  id: string;
  name: string;
  temperature: number;
  lastUpdated: string;
}

/**
 * Get temperature sensors
 */
async function getTemperatureSensors(): Promise<TemperatureSensorData[]> {
  const sensors = await getAllSensors();
  if (!sensors) return [];

  const tempSensors: TemperatureSensorData[] = [];
  for (const [id, sensor] of Object.entries(sensors)) {
    if (
      sensor.type === 'ZLLTemperature' &&
      sensor.state.temperature !== null &&
      sensor.state.temperature !== undefined
    ) {
      tempSensors.push({
        id,
        name: sensor.name,
        temperature: sensor.state.temperature / 100,
        lastUpdated: sensor.state.lastupdated,
      });
    }
  }
  return tempSensors;
}

interface MotionSensorData {
  id: string;
  name: string;
  presence: boolean;
  lastUpdated: string;
  battery?: number;
}

/**
 * Get motion sensors
 */
async function getMotionSensors(): Promise<MotionSensorData[]> {
  const sensors = await getAllSensors();
  if (!sensors) return [];

  const motionSensors: MotionSensorData[] = [];
  for (const [id, sensor] of Object.entries(sensors)) {
    if (sensor.type === 'ZLLPresence') {
      motionSensors.push({
        id,
        name: sensor.name,
        presence: sensor.state.presence ?? false,
        lastUpdated: sensor.state.lastupdated,
        battery: sensor.config?.battery,
      });
    }
  }
  return motionSensors;
}

interface LightLevelSensorData {
  id: string;
  name: string;
  lightLevel: number;
  dark: boolean;
  daylight: boolean;
  lastUpdated: string;
}

/**
 * Get light level sensors
 */
async function getLightLevelSensors(): Promise<LightLevelSensorData[]> {
  const sensors = await getAllSensors();
  if (!sensors) return [];

  const lightSensors: LightLevelSensorData[] = [];
  for (const [id, sensor] of Object.entries(sensors)) {
    if (
      sensor.type === 'ZLLLightLevel' &&
      sensor.state.lightlevel !== null &&
      sensor.state.lightlevel !== undefined
    ) {
      lightSensors.push({
        id,
        name: sensor.name,
        lightLevel: sensor.state.lightlevel,
        dark: sensor.state.dark ?? false,
        daylight: sensor.state.daylight ?? false,
        lastUpdated: sensor.state.lastupdated,
      });
    }
  }
  return lightSensors;
}

/**
 * Discover Hue bridge on the network
 * Probes /api/config endpoint which requires no auth
 */
async function discover(
  baseIp = '192.168.68',
  start = 50,
  end = 90
): Promise<HueBridgeDiscovery | null> {
  Logger.info('Scanning for Hue bridges...');

  for (let i = start; i <= end; i++) {
    const ip = `${baseIp}.${i}`;
    try {
      const response = await fetch(`http://${ip}/api/config`, {
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok) {
        const config = (await response.json()) as HueBridgeConfig;
        if (config.bridgeid && config.modelid) {
          Logger.success(`Found Hue bridge: ${config.name} @ ${ip}`);
          return {
            ip,
            name: config.name,
            model: config.modelid,
            bridgeId: config.bridgeid,
            apiVersion: config.apiversion,
          };
        }
      }
    } catch {
      // Continue scanning
    }
  }
  Logger.warn('No Hue bridge found');
  return null;
}

/**
 * Get bridge info (no auth required)
 */
async function getBridgeInfo(): Promise<HueBridgeConfig | null> {
  try {
    const config = getBridgeConfig();
    const response = await fetch(`http://${config.ip}/api/config`);
    if (!response.ok) return null;
    return (await response.json()) as HueBridgeConfig;
  } catch (error) {
    Logger.error('Error getting bridge info:', error);
    return null;
  }
}

export const HueAPI = {
  getBaseUrl,
  getAllLights,
  getLight,
  setLightState,
  toggleLight,
  getAllSensors,
  getTemperatureSensors,
  getMotionSensors,
  getLightLevelSensors,
  discover,
  getBridgeInfo,
} as const;

// Register with the service registry
Registry.register({
  key: 'HueAPI',
  instance: HueAPI,
});
