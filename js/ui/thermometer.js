/**
 * Thermometer UI Module
 * Creates and manages thermometer SVG elements
 */

import { createDraggable } from './draggable.js';

// Room positions for thermometers
const ROOM_POSITIONS = {
    // First Floor
    'temp-main-bedroom': { x: 180, y: 220 },
    'temp-landing': { x: 340, y: 220 },
    'temp-office': { x: 500, y: 220 },
    'temp-bathroom': { x: 660, y: 220 },
    'temp-guest-bedroom': { x: 820, y: 220 },
    // Ground Floor
    'temp-hall': { x: 200, y: 460 },
    'temp-lounge': { x: 400, y: 460 },
    'temp-kitchen': { x: 600, y: 460 },
    'temp-extension': { x: 800, y: 460 },
    // Outdoor
    'temp-outdoor': { x: 60, y: 10, isOutdoor: true }
};

// Custom thermometer positions (from localStorage)
let customPositions = {};

/**
 * Initialize custom positions from localStorage
 */
function initCustomPositions() {
    const stored = localStorage.getItem('thermometerPositions');
    if (stored) {
        customPositions = JSON.parse(stored);
    }
}

/**
 * Get thermometer position (custom or default)
 * @param {string} elementId - Thermometer element ID
 * @returns {Object|null} - Position object with x, y, isOutdoor
 */
function getThermometerPosition(elementId) {
    return customPositions[elementId] || ROOM_POSITIONS[elementId];
}

/**
 * Get temperature color based on value
 * @param {number} temp - Temperature in Celsius
 * @returns {string} - Color hex code
 */
function getTemperatureColor(temp) {
    if (temp < 10) return '#4169E1';  // Royal Blue - Cold
    if (temp < 15) return '#00CED1';  // Dark Turquoise - Cool
    if (temp < 20) return '#32CD32';  // Lime Green - Comfortable
    if (temp < 25) return '#FFA500';  // Orange - Warm
    return '#FF4500';  // Orange Red - Hot
}

/**
 * Create thermometer SVG element
 * @param {string} elementId - Thermometer element ID
 * @param {number} temp - Temperature in Celsius
 * @param {string} roomName - Room display name
 * @returns {SVGTextElement|null} - Temperature text element or null
 */
function createThermometer(elementId, temp, roomName) {
    const position = getThermometerPosition(elementId);
    if (!position) return null;

    const ns = 'http://www.w3.org/2000/svg';
    const group = document.createElementNS(ns, 'g');
    group.setAttribute('class', 'thermometer');
    group.setAttribute('data-room', elementId);

    // Thermometer dimensions
    const tubeWidth = 24;
    const tubeHeight = 80;
    const bulbRadius = 16;

    // Background (glass tube)
    const tube = document.createElementNS(ns, 'rect');
    tube.setAttribute('x', 0);
    tube.setAttribute('y', 0);
    tube.setAttribute('width', tubeWidth);
    tube.setAttribute('height', tubeHeight);
    tube.setAttribute('rx', 12);
    tube.setAttribute('fill', 'rgba(255, 255, 255, 0.9)');
    tube.setAttribute('stroke', '#666');
    tube.setAttribute('stroke-width', '2');
    tube.setAttribute('filter', 'url(#shadow)');
    group.appendChild(tube);

    // Bulb
    const bulb = document.createElementNS(ns, 'circle');
    bulb.setAttribute('cx', tubeWidth / 2);
    bulb.setAttribute('cy', tubeHeight + bulbRadius - 4);
    bulb.setAttribute('r', bulbRadius);
    bulb.setAttribute('fill', 'rgba(255, 255, 255, 0.9)');
    bulb.setAttribute('stroke', '#666');
    bulb.setAttribute('stroke-width', '2');
    bulb.setAttribute('filter', 'url(#shadow)');
    group.appendChild(bulb);

    // Mercury level (0-30°C range for visualization)
    const tempRange = { min: 0, max: 30 };
    const percentage = Math.max(0, Math.min(1, (temp - tempRange.min) / (tempRange.max - tempRange.min)));
    const mercuryHeight = (tubeHeight - 10) * percentage + bulbRadius * 2 - 4;

    const mercuryColor = position.isOutdoor ? '#00CED1' : getTemperatureColor(temp);

    // Mercury in bulb
    const mercuryBulb = document.createElementNS(ns, 'circle');
    mercuryBulb.setAttribute('cx', tubeWidth / 2);
    mercuryBulb.setAttribute('cy', tubeHeight + bulbRadius - 4);
    mercuryBulb.setAttribute('r', bulbRadius - 4);
    mercuryBulb.setAttribute('fill', mercuryColor);
    mercuryBulb.setAttribute('class', 'mercury-fill');
    group.appendChild(mercuryBulb);

    // Mercury in tube
    const mercuryTube = document.createElementNS(ns, 'rect');
    mercuryTube.setAttribute('x', tubeWidth / 2 - 4);
    mercuryTube.setAttribute('y', tubeHeight - mercuryHeight + bulbRadius);
    mercuryTube.setAttribute('width', 8);
    mercuryTube.setAttribute('height', mercuryHeight - bulbRadius);
    mercuryTube.setAttribute('rx', 4);
    mercuryTube.setAttribute('fill', mercuryColor);
    mercuryTube.setAttribute('class', 'mercury-fill');
    group.appendChild(mercuryTube);

    // Scale markings
    for (let i = 0; i <= 4; i++) {
        const y = tubeHeight - (tubeHeight - 10) * (i / 4) + 5;
        const mark = document.createElementNS(ns, 'line');
        mark.setAttribute('x1', tubeWidth);
        mark.setAttribute('y1', y);
        mark.setAttribute('x2', tubeWidth + 5);
        mark.setAttribute('y2', y);
        mark.setAttribute('stroke', '#666');
        mark.setAttribute('stroke-width', '1');
        group.appendChild(mark);
    }

    // Temperature text
    const tempText = document.createElementNS(ns, 'text');
    tempText.setAttribute('x', tubeWidth / 2);
    tempText.setAttribute('y', tubeHeight + bulbRadius * 2 + 20);
    tempText.setAttribute('text-anchor', 'middle');
    tempText.setAttribute('font-size', '18');
    tempText.setAttribute('font-weight', '700');
    tempText.setAttribute('font-family', 'Baloo 2');
    tempText.setAttribute('fill', 'white');
    tempText.setAttribute('stroke', '#333');
    tempText.setAttribute('stroke-width', '3');
    tempText.setAttribute('paint-order', 'stroke fill');
    tempText.setAttribute('id', elementId);
    tempText.textContent = temp.toFixed(1) + '°C';
    group.appendChild(tempText);

    // Room label
    const label = document.createElementNS(ns, 'text');
    label.setAttribute('x', tubeWidth / 2);
    label.setAttribute('y', -8);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', position.isOutdoor ? '12' : '11');
    label.setAttribute('font-weight', position.isOutdoor ? '700' : '600');
    label.setAttribute('font-family', 'Fredoka');
    label.setAttribute('fill', position.isOutdoor ? '#0066CC' : '#333');
    label.textContent = roomName;
    group.appendChild(label);

    // Position the thermometer
    group.setAttribute('transform', `translate(${position.x}, ${position.y})`);

    // Add to appropriate container
    const containerId = position.isOutdoor ? 'outdoor-thermometer-container' : 'thermometers-container';
    const container = document.getElementById(containerId);
    if (container) {
        container.appendChild(group);
    }

    // Make draggable
    makeDraggable(group, elementId, position);

    return tempText;
}

/**
 * Make thermometer draggable
 * @param {SVGElement} group - Thermometer group element
 * @param {string} elementId - Element ID
 * @param {Object} position - Position object
 */
function makeDraggable(group, elementId, position) {
    createDraggable(group, {
        cursor: 'move',
        customSave: (element) => {
            const transform = element.getAttribute('transform');
            const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
            if (match) {
                customPositions[elementId] = {
                    x: parseFloat(match[1]),
                    y: parseFloat(match[2]),
                    isOutdoor: position.isOutdoor
                };
                localStorage.setItem('thermometerPositions', JSON.stringify(customPositions));
            }
        }
    });
}

/**
 * Reset all thermometer positions to defaults
 */
function resetThermometerPositions() {
    if (confirm('Reset all thermometer positions to defaults?')) {
        localStorage.removeItem('thermometerPositions');
        customPositions = {};
        location.reload();
    }
}

/**
 * Create sparkle effect around element
 * @param {Element} element - Element to sparkle around
 */
function createSparkles(element) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const sparkleEmojis = ['✨', '⭐', '🌟', '💫'];
    const numSparkles = 8;

    for (let i = 0; i < numSparkles; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle-star';
        sparkle.textContent = sparkleEmojis[Math.floor(Math.random() * sparkleEmojis.length)];

        const angle = (Math.PI * 2 * i) / numSparkles;
        const distance = 50 + Math.random() * 30;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;

        sparkle.style.left = centerX + 'px';
        sparkle.style.top = centerY + 'px';
        sparkle.style.setProperty('--tx', tx + 'px');
        sparkle.style.setProperty('--ty', ty + 'px');

        document.body.appendChild(sparkle);

        setTimeout(() => sparkle.remove(), 1000);
    }
}

/**
 * Clear all thermometers from containers
 */
function clearThermometers() {
    const indoorContainer = document.getElementById('thermometers-container');
    const outdoorContainer = document.getElementById('outdoor-thermometer-container');

    if (indoorContainer) indoorContainer.innerHTML = '';
    if (outdoorContainer) outdoorContainer.innerHTML = '';
}

// Initialize on load
initCustomPositions();

// Export for ES6 modules
export {
    createThermometer,
    getTemperatureColor,
    getThermometerPosition,
    resetThermometerPositions,
    createSparkles,
    clearThermometers,
    ROOM_POSITIONS
};
