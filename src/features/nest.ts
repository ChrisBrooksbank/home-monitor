/**
 * Nest Thermostat Integration Module
 * Handles Google Nest thermostat communication and display
 */

import { Logger } from '../utils/logger';
import { Registry } from '../core/registry';
import { getNestConfigWithFallback } from '../config/config-bridge';
import type { NestThermostat, AppConfig } from '../types';

// Helper to get APP_CONFIG from Registry
function getAppConfig() {
  return Registry.getOptional('APP_CONFIG') as AppConfig | undefined;
}

// Internal Nest configuration interface (with legacy snake_case support)
interface NestConfigInternal {
  clientId: string | undefined;
  clientSecret: string | undefined;
  projectId: string | undefined;
  refreshToken: string | undefined;
  accessToken: string | undefined;
  expiresAt: number | undefined;
}

// Thermostat status interface
export interface ThermostatStatus {
  name: string;
  currentTemp: number | null;
  targetTemp: number | null;
  humidity: number | null;
  mode: string;
  status: string;
  statusColor: string;
}

// Nest state
let nestDevices: NestThermostat[] = [];
let nestAccessToken: string | null = null;
let nestTokenExpiry = 0;

// Get Nest configuration from global config (supports both UPPER_CASE and snake_case)
const getNestConfig = (): NestConfigInternal => {
  // Use fallback function that checks Registry then window global
  const cfg = getNestConfigWithFallback() as Record<string, string | number | undefined> | undefined;
  return {
    clientId: cfg?.CLIENT_ID as string | undefined,
    clientSecret: cfg?.CLIENT_SECRET as string | undefined,
    projectId: cfg?.PROJECT_ID as string | undefined,
    refreshToken: (cfg?.REFRESH_TOKEN || cfg?.refresh_token) as string | undefined,
    accessToken: (cfg?.ACCESS_TOKEN || cfg?.access_token) as string | undefined,
    expiresAt: (cfg?.expires_at || cfg?.EXPIRES_AT) as number | undefined,
  };
};

/**
 * Initialize Nest tokens from config
 */
function initTokens(): void {
  const config = getNestConfig();
  nestAccessToken = config.accessToken || null;
  nestTokenExpiry = config.expiresAt || 0;
}

/**
 * Refresh Nest access token
 */
async function refreshNestToken(): Promise<boolean> {
  const config = getNestConfig();

  if (!config.clientId || !config.clientSecret || !config.refreshToken) {
    Logger.error('Missing OAuth credentials for token refresh');
    return false;
  }

  const tokenData = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: 'refresh_token',
  }).toString();

  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v4/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenData,
    });

    const tokens = await response.json();

    if (tokens.access_token) {
      nestAccessToken = tokens.access_token;
      nestTokenExpiry = Date.now() + tokens.expires_in * 1000;
      Logger.success('Nest token refreshed');
      return true;
    } else {
      Logger.error('Failed to refresh Nest token:', tokens.error || 'Unknown error');
      return false;
    }
  } catch (error) {
    Logger.error('Error refreshing Nest token:', error);
    return false;
  }
}

/**
 * Check if token needs refresh (5 min before expiry)
 */
function tokenNeedsRefresh(): boolean {
  return Date.now() > nestTokenExpiry - 5 * 60 * 1000;
}

/**
 * Fetch Nest devices from API
 */
async function fetchNestDevices(): Promise<NestThermostat[] | null> {
  // Always refresh token - Google access tokens only last 1 hour
  const refreshed = await refreshNestToken();
  if (!refreshed) {
    return null;
  }

  const config = getNestConfig();

  try {
    const response = await fetch(
      `https://smartdevicemanagement.googleapis.com/v1/enterprises/${config.projectId}/devices`,
      {
        headers: { Authorization: `Bearer ${nestAccessToken}` },
      }
    );

    if (!response.ok) {
      Logger.error('Nest API error:', response.status);
      return null;
    }

    const data = await response.json();
    nestDevices = data.devices || [];
    return nestDevices;
  } catch (error) {
    Logger.error('Error fetching Nest devices:', error);
    return null;
  }
}

/**
 * Set Nest thermostat temperature
 */
async function setNestTemperature(targetTempC: number): Promise<boolean> {
  if (nestDevices.length === 0) {
    Logger.error('No Nest devices found');
    return false;
  }

  if (tokenNeedsRefresh()) {
    const refreshed = await refreshNestToken();
    if (!refreshed) return false;
  }

  const device = nestDevices[0];
  const deviceName = device.name;

  Logger.info(`Setting Nest temperature to ${targetTempC}°C...`);

  try {
    const response = await fetch(
      `https://smartdevicemanagement.googleapis.com/v1/${deviceName}:executeCommand`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${nestAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: 'sdm.devices.commands.ThermostatTemperatureSetpoint.SetHeat',
          params: { heatCelsius: targetTempC },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      Logger.error('Failed to set temperature:', error);
      return false;
    }

    Logger.info(`Temperature set to ${targetTempC}°C`);
    return true;
  } catch (error) {
    Logger.error('Error setting temperature:', error);
    return false;
  }
}

/**
 * Get thermostat status from device traits
 */
function getThermostatStatus(device: NestThermostat): ThermostatStatus {
  const tempTrait = device.traits['sdm.devices.traits.Temperature'];
  const thermostatTrait = device.traits['sdm.devices.traits.ThermostatTemperatureSetpoint'];
  const humidityTrait = device.traits['sdm.devices.traits.Humidity'];
  const modeTrait = device.traits['sdm.devices.traits.ThermostatMode'];

  const result: ThermostatStatus = {
    name: device.displayName || 'Nest Thermostat',
    currentTemp: tempTrait?.ambientTemperatureCelsius || null,
    targetTemp: null,
    humidity: humidityTrait?.ambientHumidityPercent || null,
    mode: modeTrait?.mode?.toUpperCase() || 'OFF',
    status: 'OFF',
    statusColor: '#999',
  };

  if (thermostatTrait?.heatCelsius) {
    result.targetTemp = thermostatTrait.heatCelsius;
    result.mode = 'HEAT';
    if (result.currentTemp && result.currentTemp < thermostatTrait.heatCelsius - 0.5) {
      result.status = 'HEATING';
      result.statusColor = '#FF6B35';
    } else {
      result.status = 'IDLE';
      result.statusColor = '#4CAF50';
    }
  } else if (thermostatTrait?.coolCelsius) {
    result.targetTemp = thermostatTrait.coolCelsius;
    result.mode = 'COOL';
    if (result.currentTemp && result.currentTemp > thermostatTrait.coolCelsius + 0.5) {
      result.status = 'COOLING';
      result.statusColor = '#4ECDC4';
    } else {
      result.status = 'IDLE';
      result.statusColor = '#4CAF50';
    }
  }

  return result;
}

/**
 * Update Nest visual display in SVG
 */
function updateNestVisualDisplay(
  currentTemp: number,
  targetTemp: number | null,
  status: string,
  statusColor: string
): void {
  const currentTempEl = document.getElementById('nest-current-temp');
  const targetTempEl = document.getElementById('nest-target-temp');
  const statusTextEl = document.getElementById('nest-status-text');
  const statusRingEl = document.getElementById('nest-status-ring');
  const displayBgEl = document.getElementById('nest-display-bg');

  if (!currentTempEl) {
    Logger.warn('Nest visual display elements not found in DOM');
    return;
  }

  // Update current temperature
  currentTempEl.textContent = currentTemp.toFixed(1) + '°';

  // Update target temperature
  if (targetTempEl) {
    if (targetTemp) {
      targetTempEl.textContent = '→ ' + targetTemp.toFixed(1) + '°';
      targetTempEl.setAttribute('fill', '#888888');
    } else {
      targetTempEl.textContent = '';
    }
  }

  // Update status
  if (statusTextEl) statusTextEl.textContent = status;
  if (statusRingEl) statusRingEl.setAttribute('stroke', statusColor);

  // Update display background
  if (displayBgEl) {
    if (status === 'HEATING') {
      displayBgEl.setAttribute('fill', '#1a0f00');
      currentTempEl.setAttribute('fill', '#FFB84D');
    } else if (status === 'COOLING') {
      displayBgEl.setAttribute('fill', '#001a1a');
      currentTempEl.setAttribute('fill', '#66D9EF');
    } else {
      displayBgEl.setAttribute('fill', '#000000');
      currentTempEl.setAttribute('fill', '#FFFFFF');
    }
  }
}

/**
 * Update Nest display with fresh data
 */
async function updateNestDisplay(): Promise<void> {
  Logger.info('Fetching Nest devices...');
  const devices = await fetchNestDevices();

  if (!devices || devices.length === 0) {
    Logger.warn('No Nest devices returned');
    return;
  }

  devices.forEach((device) => {
    const status = getThermostatStatus(device);

    if (status.currentTemp) {
      Logger.info(`${status.name}: ${status.currentTemp.toFixed(1)}°C`);
      updateNestVisualDisplay(status.currentTemp, status.targetTemp, status.status, status.statusColor);
    }
  });
}

/**
 * Make Nest thermostat draggable with temperature adjustment
 */
function makeNestDraggable(group: SVGElement): void {
  let isDragging = false;
  let isAdjustingTemp = false;
  let startX: number, startY: number;
  let currentTransform: { x: number; y: number };
  let startTemp: number, currentAdjustedTemp: number;

  (group as SVGElement & { style: CSSStyleDeclaration }).style.cursor = 'pointer';

  // Load saved position
  const savedPosition = localStorage.getItem('nestThermostatPosition');
  if (savedPosition) {
    try {
      const position = JSON.parse(savedPosition);
      group.setAttribute('transform', `translate(${position.x}, ${position.y})`);
    } catch (e) {
      // Ignore parse errors
    }
  }

  function getCurrentTargetTemp(): number {
    if (nestDevices.length === 0) return 21;
    const device = nestDevices[0];
    const thermostatTrait = device.traits['sdm.devices.traits.ThermostatTemperatureSetpoint'];
    return thermostatTrait?.heatCelsius || thermostatTrait?.coolCelsius || 21;
  }

  function handleStart(e: MouseEvent | TouchEvent): void {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    startX = clientX;
    startY = clientY;

    if ((e as MouseEvent).shiftKey) {
      // Shift+drag = Temperature adjustment mode
      isAdjustingTemp = true;
      startTemp = getCurrentTargetTemp();
      currentAdjustedTemp = startTemp;

      const statusRing = document.getElementById('nest-status-ring');
      if (statusRing) {
        statusRing.setAttribute('stroke', '#4A90E2');
        statusRing.setAttribute('opacity', '0.8');
      }
    } else {
      // Normal drag = Position dragging mode
      isDragging = true;
      const transform = group.getAttribute('transform') || 'translate(0,0)';
      const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
      currentTransform = {
        x: match ? parseFloat(match[1]) : 0,
        y: match ? parseFloat(match[2]) : 0,
      };
      (group as SVGElement & { style: CSSStyleDeclaration }).style.cursor = 'move';
      (group as SVGElement & { style: CSSStyleDeclaration }).style.opacity = '0.7';
    }

    e.preventDefault();
    e.stopPropagation();
  }

  function handleMove(e: MouseEvent | TouchEvent): void {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    if (isDragging) {
      const dx = clientX - startX;
      const dy = clientY - startY;
      const newX = currentTransform.x + dx;
      const newY = currentTransform.y + dy;
      group.setAttribute('transform', `translate(${newX}, ${newY})`);
    } else if (isAdjustingTemp) {
      const dy = startY - clientY;
      const tempChange = Math.round(dy / 10) * 0.5;
      currentAdjustedTemp = Math.max(10, Math.min(30, startTemp + tempChange));

      const targetTempEl = document.getElementById('nest-target-temp');
      const currentTempEl = document.getElementById('nest-current-temp');
      if (targetTempEl && currentTempEl) {
        targetTempEl.textContent = `SET: ${currentAdjustedTemp.toFixed(1)}°C`;
        targetTempEl.setAttribute('fill', '#4A90E2');
        targetTempEl.setAttribute('font-size', '12');
        currentTempEl.setAttribute('font-size', '24');
      }
    }
  }

  async function handleEnd(): Promise<void> {
    if (isDragging) {
      isDragging = false;
      (group as SVGElement & { style: CSSStyleDeclaration }).style.opacity = '1';
      (group as SVGElement & { style: CSSStyleDeclaration }).style.cursor = 'pointer';

      const transform = group.getAttribute('transform') || 'translate(0,0)';
      const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
      if (match) {
        const position = { x: parseFloat(match[1]), y: parseFloat(match[2]) };
        localStorage.setItem('nestThermostatPosition', JSON.stringify(position));
      }
    } else if (isAdjustingTemp) {
      isAdjustingTemp = false;

      const statusRing = document.getElementById('nest-status-ring');
      if (statusRing) {
        statusRing.setAttribute('opacity', '0.6');
      }

      if (Math.abs(currentAdjustedTemp - startTemp) >= 0.5) {
        await setNestTemperature(currentAdjustedTemp);
      } else {
        updateNestDisplay();
      }
    }
  }

  group.addEventListener('mousedown', handleStart);
  group.addEventListener('touchstart', handleStart, { passive: false });
  document.addEventListener('mousemove', handleMove);
  document.addEventListener('touchmove', handleMove, { passive: false });
  document.addEventListener('mouseup', handleEnd);
  document.addEventListener('touchend', handleEnd);
}

/**
 * Initialize Nest integration
 */
function initNestIntegration(
  intervalManager?: { register: (fn: () => void | Promise<void>, interval: number) => void },
  pollInterval: number = 15 * 60 * 1000
): void {
  const config = getNestConfig();

  if (!config.accessToken) {
    Logger.info('Nest not configured. Run: node scripts/setup/nest-auth.cjs');
    return;
  }

  initTokens();
  Logger.info('Nest integration initialized');

  // Make thermostat draggable
  const nestDisplay = document.getElementById('nest-thermostat-display') as unknown as SVGElement | null;
  if (nestDisplay) {
    makeNestDraggable(nestDisplay);
  }

  // Initial fetch
  updateNestDisplay();

  // Register polling interval
  if (intervalManager) {
    intervalManager.register(updateNestDisplay, pollInterval);
  }

}

/**
 * Get current Nest devices
 */
function getDevices(): NestThermostat[] {
  return nestDevices;
}

/**
 * Nest Integration module export
 */
export const NestIntegration = {
  init: initNestIntegration,
  fetchDevices: fetchNestDevices,
  setTemperature: setNestTemperature,
  updateDisplay: updateNestDisplay,
  getDevices: getDevices,
  getThermostatStatus,
};

// Register with the service registry
Registry.register({
  key: 'NestIntegration',
  instance: NestIntegration,
});

// Auto-initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const intervalManager = Registry.getOptional('IntervalManager');
      const config = getAppConfig();
      initNestIntegration(intervalManager, config?.intervals?.nest ?? 15 * 60 * 1000);
    });
  } else {
    const intervalManager = Registry.getOptional('IntervalManager');
    const config = getAppConfig();
    initNestIntegration(intervalManager, config?.intervals?.nest ?? 15 * 60 * 1000);
  }
}
