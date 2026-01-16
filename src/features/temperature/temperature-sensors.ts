/**
 * Temperature Sensors Module
 * Handles temperature sensor data loading and history management using AppState
 */

import type { TemperatureHistoryEntry } from '../../types';
import { Logger } from '../../utils/logger';
import { AppState } from '../../core/state';
import { AppEvents } from '../../core/events';
import { HueAPI } from '../../api/hue';
import { sensorMapping, roomNames } from '../../config/mappings';
import { createThermometer, createSparkles } from './thermometer-ui';

/**
 * Get temperature history from AppState
 */
function getTempHistory(): Record<string, TemperatureHistoryEntry[]> {
    return AppState.get<Record<string, TemperatureHistoryEntry[]>>('tempHistory') ?? {};
}

/**
 * Initialize temperature history - clean up old entries
 */
export function initTempHistory(): void {
    // AppState handles loading from localStorage automatically
    // Just clean up old entries
    const tempHistory = getTempHistory();
    const now = Date.now();
    const cutoff = now - 24 * 60 * 60 * 1000;
    const cleaned: Record<string, TemperatureHistoryEntry[]> = {};
    for (const room in tempHistory) {
        cleaned[room] = tempHistory[room].filter(entry => entry.time > cutoff);
    }
    AppState.set('tempHistory', cleaned);
}

/**
 * Save temperature data point
 */
function saveTempData(room: string, temp: string): void {
    const now = Date.now();
    const tempHistory = getTempHistory();
    if (!tempHistory[room]) tempHistory[room] = [];
    tempHistory[room].push({ time: now, temp: parseFloat(temp) });
    const cutoff = now - 24 * 60 * 60 * 1000;
    tempHistory[room] = tempHistory[room].filter(entry => entry.time > cutoff);
    AppState.set('tempHistory', tempHistory);
}

interface TemperatureReading {
    sensorId: string;
    room: string;
    temp: number;
    lastUpdated: string;
}

/**
 * Load temperatures from Hue Bridge
 */
export async function loadTemperatures(showSparkles = true): Promise<void> {
    try {
        const sensors = await HueAPI.getAllSensors();
        if (!sensors) throw new Error('Failed to fetch sensors');

        const thermometersContainer = document.getElementById('thermometers-container');
        const outdoorContainer = document.getElementById('outdoor-thermometer-container');
        if (thermometersContainer) thermometersContainer.innerHTML = '';
        if (outdoorContainer) outdoorContainer.innerHTML = '';

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
