/**
 * Temperature Monitoring and History
 * Handles temperature sensor data, history tracking, and graph rendering
 */

import { TEMP_HISTORY_RETENTION, GRAPH, TEMPERATURE } from '../config/constants.js';

// Temperature history storage
export let tempHistory = {};

/**
 * Initialize temperature history from localStorage
 */
export function initTempHistory() {
    const stored = localStorage.getItem('tempHistory');
    if (stored) {
        tempHistory = JSON.parse(stored);
        // Clean old data (older than retention period)
        const now = Date.now();
        const cutoff = now - TEMP_HISTORY_RETENTION;
        for (let room in tempHistory) {
            tempHistory[room] = tempHistory[room].filter(entry => entry.time > cutoff);
        }
    } else {
        tempHistory = {};
    }
}

/**
 * Save temperature data point
 * @param {string} room - Room name
 * @param {number} temp - Temperature in Celsius
 */
export function saveTempData(room, temp) {
    const now = Date.now();
    if (!tempHistory[room]) {
        tempHistory[room] = [];
    }
    tempHistory[room].push({ time: now, temp: parseFloat(temp) });

    // Keep only last retention period
    const cutoff = now - TEMP_HISTORY_RETENTION;
    tempHistory[room] = tempHistory[room].filter(entry => entry.time > cutoff);

    localStorage.setItem('tempHistory', JSON.stringify(tempHistory));
}

/**
 * Draw temperature graph
 */
export function drawGraph() {
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

    for (let room in tempHistory) {
        tempHistory[room].forEach(entry => {
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
        const temp = minTemp + (tempRange * i / 5);
        const y = 350 - (temp - minTemp) / tempRange * GRAPH.HEIGHT;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', GRAPH.MARGIN_LEFT);
        line.setAttribute('y1', y);
        line.setAttribute('x2', GRAPH.MARGIN_LEFT + GRAPH.WIDTH);
        line.setAttribute('y2', y);
        line.setAttribute('stroke', '#e0e0e0');
        line.setAttribute('stroke-width', '1');
        line.setAttribute('stroke-dasharray', '5,5');
        gridLines.appendChild(line);

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', GRAPH.MARGIN_LEFT - 10);
        label.setAttribute('y', y + 5);
        label.setAttribute('text-anchor', 'end');
        label.setAttribute('font-size', '12');
        label.setAttribute('fill', '#666');
        label.textContent = temp.toFixed(1) + '°C';
        axisLabels.appendChild(label);
    }

    // Draw time labels (every 4 hours)
    for (let i = 0; i <= 6; i++) {
        const time = oneDayAgo + (TEMP_HISTORY_RETENTION * i / 6);
        const x = GRAPH.MARGIN_LEFT + (GRAPH.WIDTH * i / 6);
        const date = new Date(time);
        const hours = date.getHours().toString().padStart(2, '0');

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', x);
        label.setAttribute('y', 370);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', '12');
        label.setAttribute('fill', '#666');
        label.textContent = hours + ':00';
        axisLabels.appendChild(label);
    }

    // Draw lines for each room (rest of the implementation continues...)
    // This is a simplified version for demonstration
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        tempHistory,
        initTempHistory,
        saveTempData,
        drawGraph
    };
}
