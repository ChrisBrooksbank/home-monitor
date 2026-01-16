/**
 * Motion Sensors Module
 * Handles motion sensor data loading, history, and log display
 */

import type { MotionSensors, MotionHistoryEntry } from '../../types';
import { Logger } from '../../utils/logger';
import { AppState } from '../../core/state';
import { AppEvents } from '../../core/events';
import { HueAPI } from '../../api/hue';
import { mapMotionSensorToRoom } from '../../config/mappings';

/**
 * Get motion sensors from AppState
 */
export function getMotionSensors(): MotionSensors {
    return AppState.get<MotionSensors>('motion') ?? {};
}

/**
 * Get motion history from AppState
 */
function getMotionHistory(): MotionHistoryEntry[] {
    return AppState.get<MotionHistoryEntry[]>('motionHistory') ?? [];
}

/**
 * Initialize motion history - clean up old entries
 */
export function initMotionHistory(): void {
    // AppState handles loading from localStorage automatically
    // Just clean up old entries
    const motionHistory = getMotionHistory();
    const now = Date.now();
    const cutoff = now - 48 * 60 * 60 * 1000;
    const cleaned = motionHistory.filter(entry => entry.time > cutoff);
    AppState.set('motionHistory', cleaned);
    updateMotionLogDisplay();
}

/**
 * Log a motion event
 */
function logMotionEvent(room: string): void {
    const now = Date.now();
    const motionHistory = getMotionHistory();
    motionHistory.push({ type: 'motion', location: room, room: room, time: now });
    const cutoff = now - 48 * 60 * 60 * 1000;
    const cleaned = motionHistory.filter(entry => entry.time > cutoff);
    AppState.set('motionHistory', cleaned);
    updateMotionLogDisplay();
}

/**
 * Update the motion log display in the UI
 */
export function updateMotionLogDisplay(): void {
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
    sortedHistory.forEach(entry => {
        const date = new Date(entry.time);
        const dateKey = date.toLocaleDateString();
        if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
        groupedByDate[dateKey].push(entry);
    });

    let html = '';
    for (const [dateKey, events] of Object.entries(groupedByDate)) {
        html += `<div style="margin-bottom: 15px;"><div style="font-weight: bold; margin-bottom: 8px;">\u{1F4C5} ${dateKey}</div>`;
        events.forEach(entry => {
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

/**
 * Load motion sensors from Hue Bridge
 */
export async function loadMotionSensors(): Promise<void> {
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
