/**
 * Temperature Monitoring and History
 * Handles temperature sensor data, history tracking, and graph rendering
 */

import { Logger } from '../utils/logger';
import { TEMP_HISTORY_RETENTION, GRAPH, TEMPERATURE } from '../config';
import type { TemperatureHistoryEntry } from '../types';

// Temperature history storage
export let tempHistory: Record<string, TemperatureHistoryEntry[]> = {};

/**
 * Initialize temperature history from localStorage
 */
export function initTempHistory(): void {
  const stored = localStorage.getItem('tempHistory');
  if (stored) {
    try {
      tempHistory = JSON.parse(stored);
      // Clean old data (older than retention period)
      const now = Date.now();
      const cutoff = now - TEMP_HISTORY_RETENTION;
      for (const room in tempHistory) {
        tempHistory[room] = tempHistory[room].filter((entry) => entry.time > cutoff);
      }
    } catch (e) {
      Logger.error('Error parsing temperature history:', e);
      tempHistory = {};
    }
  } else {
    tempHistory = {};
  }
}

/**
 * Save temperature data point
 */
export function saveTempData(room: string, temp: number): void {
  const now = Date.now();
  if (!tempHistory[room]) {
    tempHistory[room] = [];
  }
  tempHistory[room].push({ time: now, temp: parseFloat(String(temp)) });

  // Keep only last retention period
  const cutoff = now - TEMP_HISTORY_RETENTION;
  tempHistory[room] = tempHistory[room].filter((entry) => entry.time > cutoff);

  localStorage.setItem('tempHistory', JSON.stringify(tempHistory));
}

/**
 * Get temperature history for a room
 */
export function getTempHistory(room?: string): Record<string, TemperatureHistoryEntry[]> | TemperatureHistoryEntry[] {
  if (room) {
    return tempHistory[room] || [];
  }
  return tempHistory;
}

/**
 * Clear temperature history
 */
export function clearTempHistory(room?: string): void {
  if (room) {
    delete tempHistory[room];
  } else {
    tempHistory = {};
  }
  localStorage.setItem('tempHistory', JSON.stringify(tempHistory));
}

/**
 * Draw temperature graph
 */
export function drawGraph(): void {
  const graphLines = document.getElementById('graph-lines');
  const gridLines = document.getElementById('grid-lines');
  const axisLabels = document.getElementById('axis-labels');
  const legend = document.getElementById('legend');

  // Check if graph elements exist in DOM
  if (!graphLines || !gridLines || !axisLabels || !legend) {
    return; // Graph not rendered yet
  }

  // Clear existing elements
  graphLines.innerHTML = '';
  gridLines.innerHTML = '';
  axisLabels.innerHTML = '';
  legend.innerHTML = '';

  const now = Date.now();
  const oneDayAgo = now - TEMP_HISTORY_RETENTION;

  // Find min/max temps across all rooms
  let minTemp = Infinity;
  let maxTemp = -Infinity;

  for (const room in tempHistory) {
    tempHistory[room].forEach((entry) => {
      if (entry.temp < minTemp) minTemp = entry.temp;
      if (entry.temp > maxTemp) maxTemp = entry.temp;
    });
  }

  if (minTemp === Infinity) {
    minTemp = TEMPERATURE.MIN_DISPLAY;
    maxTemp = TEMPERATURE.MAX_DISPLAY;
  } else {
    minTemp = Math.floor(minTemp) - TEMPERATURE.BUFFER;
    maxTemp = Math.ceil(maxTemp) + TEMPERATURE.BUFFER;
  }

  // Draw grid lines
  const tempRange = maxTemp - minTemp;
  for (let i = 0; i <= 5; i++) {
    const temp = minTemp + (tempRange * i) / 5;
    const y = 350 - ((temp - minTemp) / tempRange) * GRAPH.HEIGHT;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(GRAPH.MARGIN_LEFT));
    line.setAttribute('y1', String(y));
    line.setAttribute('x2', String(GRAPH.MARGIN_LEFT + GRAPH.WIDTH));
    line.setAttribute('y2', String(y));
    line.setAttribute('stroke', '#e0e0e0');
    line.setAttribute('stroke-width', '1');
    line.setAttribute('stroke-dasharray', '5,5');
    gridLines.appendChild(line);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(GRAPH.MARGIN_LEFT - 10));
    label.setAttribute('y', String(y + 5));
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('font-size', '12');
    label.setAttribute('fill', '#666');
    label.textContent = temp.toFixed(1) + '°C';
    axisLabels.appendChild(label);
  }

  // Draw time labels (every 4 hours)
  for (let i = 0; i <= 6; i++) {
    const time = oneDayAgo + (TEMP_HISTORY_RETENTION * i) / 6;
    const x = GRAPH.MARGIN_LEFT + (GRAPH.WIDTH * i) / 6;
    const date = new Date(time);
    const hours = date.getHours().toString().padStart(2, '0');

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', String(x));
    label.setAttribute('y', '370');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '12');
    label.setAttribute('fill', '#666');
    label.textContent = hours + ':00';
    axisLabels.appendChild(label);
  }

  // Room colors for lines
  const roomColors: Record<string, string> = {
    'Main Bedroom': '#FF6B6B',
    'Guest Bedroom': '#4ECDC4',
    Bathroom: '#45B7D1',
    Landing: '#96CEB4',
    Hall: '#FFEAA7',
    'Home Office': '#DDA0DD',
    Lounge: '#FFB347',
    Kitchen: '#87CEEB',
    Extension: '#98D8C8',
    Outdoor: '#C39BD3',
  };

  // Draw lines for each room
  let legendX = GRAPH.MARGIN_LEFT;
  for (const [room, entries] of Object.entries(tempHistory)) {
    if (entries.length < 2) continue;

    const color = roomColors[room] || '#999';
    let pathD = '';

    entries.forEach((entry, index) => {
      const x = GRAPH.MARGIN_LEFT + ((entry.time - oneDayAgo) / TEMP_HISTORY_RETENTION) * GRAPH.WIDTH;
      const y = 350 - ((entry.temp - minTemp) / tempRange) * GRAPH.HEIGHT;

      if (index === 0) {
        pathD = `M ${x} ${y}`;
      } else {
        pathD += ` L ${x} ${y}`;
      }
    });

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    graphLines.appendChild(path);

    // Add legend item
    const legendRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    legendRect.setAttribute('x', String(legendX));
    legendRect.setAttribute('y', '390');
    legendRect.setAttribute('width', '12');
    legendRect.setAttribute('height', '12');
    legendRect.setAttribute('fill', color);
    legend.appendChild(legendRect);

    const legendText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    legendText.setAttribute('x', String(legendX + 16));
    legendText.setAttribute('y', '400');
    legendText.setAttribute('font-size', '10');
    legendText.setAttribute('fill', '#666');
    legendText.textContent = room;
    legend.appendChild(legendText);

    legendX += 100;
  }

  Logger.debug('Temperature graph drawn');
}

/**
 * Temperature module export
 */
export const Temperature = {
  initHistory: initTempHistory,
  saveData: saveTempData,
  getHistory: getTempHistory,
  clearHistory: clearTempHistory,
  drawGraph,
  get history(): Record<string, TemperatureHistoryEntry[]> {
    return tempHistory;
  },
};

// Expose on window for backwards compatibility
if (typeof window !== 'undefined') {
  (window as Window & { Temperature?: typeof Temperature }).Temperature = Temperature;
}
