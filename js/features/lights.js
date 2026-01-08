/**
 * Lights Feature Module
 * Handles light control, indicators, lamppost, and room mapping
 *
 * Uses HueAPI from js/api/hue.js for all Hue Bridge communication.
 */

import { HOUSE_CONFIG } from '../config/house.js';

// Store light states for each room
const roomLights = {
    'Main Bedroom': [],
    'Guest Bedroom': [],
    'Landing': [],
    'Home Office': [],
    'Bathroom': [],
    'Lounge': [],
    'Hall': [],
    'Extension': [],
    'Kitchen': [],
    'Outdoor': []
};

// Track previous light states for announcements
const previousLightStates = {};

// Light indicator positions on the house SVG
const LIGHT_POSITIONS = {
    'Main Bedroom': { x: 180, y: 240 },
    'Landing': { x: 340, y: 240 },
    'Home Office': { x: 500, y: 240 },
    'Bathroom': { x: 660, y: 240 },
    'Guest Bedroom': { x: 820, y: 240 },
    'Hall': { x: 200, y: 405 },
    'Lounge': { x: 400, y: 405 },
    'Kitchen': { x: 600, y: 405 },
    'Extension': { x: 800, y: 405 }
};

/**
 * Map a light name to a room using config patterns
 * @param {string} lightName - Name of the light
 * @returns {string|null} - Room name or null if not mapped
 */
function mapLightToRoom(lightName) {
    const nameLower = lightName.toLowerCase();

    for (const [pattern, room] of Object.entries(HOUSE_CONFIG.lightMappings)) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(nameLower)) {
            return room;
        }
    }

    return null;
}

/**
 * Toggle a light on/off
 * @param {string} lightId - Light ID
 * @param {boolean} currentState - Current on/off state
 * @param {Function} onSuccess - Callback on success
 */
async function toggleLight(lightId, currentState, onSuccess) {
    try {
        const newState = !currentState;
        const success = await window.HueAPI.setLightState(lightId, { on: newState });

        if (success) {
            // Get light name for logging
            const lightData = await window.HueAPI.getLight(lightId);
            if (lightData) {
                const lightName = lightData.name || `Light ${lightId}`;
                if (typeof logLightEvent === 'function') {
                    logLightEvent(lightName, newState);
                }
            } else if (typeof logLightEvent === 'function') {
                logLightEvent(`Light ${lightId}`, newState);
            }

            if (onSuccess) {
                setTimeout(onSuccess, 500);
            }
        } else {
            Logger.error('Failed to toggle light');
        }
    } catch (error) {
        Logger.error('Error toggling light:', error);
    }
}

/**
 * Load lights from Hue Bridge and update state
 * @param {Function} announceLight - Function to announce light changes
 * @returns {Promise<Object>} - Room lights object
 */
async function loadLights(announceLight) {
    try {
        const lights = await window.HueAPI.getAllLights();
        if (!lights) return roomLights;

        // Clear previous light data
        for (let room in roomLights) {
            roomLights[room] = [];
        }

        // Map lights to rooms and detect changes
        for (const [lightId, lightInfo] of Object.entries(lights)) {
            const room = mapLightToRoom(lightInfo.name);
            if (room && roomLights[room]) {
                const currentState = lightInfo.state.on;

                // Check if this light's state changed
                if (previousLightStates[lightId] !== undefined &&
                    previousLightStates[lightId] !== currentState &&
                    lightInfo.state.reachable) {
                    // Light state changed - announce it
                    if (announceLight) {
                        announceLight(room, currentState);
                    }
                }

                // Update previous state
                previousLightStates[lightId] = currentState;

                roomLights[room].push({
                    id: lightId,
                    name: lightInfo.name,
                    on: currentState,
                    reachable: lightInfo.state.reachable
                });
            }
        }

        return roomLights;
    } catch (error) {
        Logger.error('Error loading lights:', error);
        return roomLights;
    }
}

/**
 * Update light indicator SVG elements
 * @param {SVGElement} container - Container element for indicators
 */
function updateLightIndicators(container) {
    if (!container) return;

    container.innerHTML = '';
    const ns = 'http://www.w3.org/2000/svg';

    for (const [room, lights] of Object.entries(roomLights)) {
        if (lights.length === 0) continue;

        const pos = LIGHT_POSITIONS[room];
        if (!pos) continue;

        const group = document.createElementNS(ns, 'g');

        lights.forEach((light, index) => {
            const offsetX = (index - (lights.length - 1) / 2) * 20;

            // Light bulb icon
            const bulb = document.createElementNS(ns, 'circle');
            bulb.setAttribute('cx', pos.x + offsetX);
            bulb.setAttribute('cy', pos.y);
            bulb.setAttribute('r', 6);
            bulb.setAttribute('fill', light.on ? '#FFD700' : '#666');
            bulb.setAttribute('stroke', light.on ? '#FFA500' : '#333');
            bulb.setAttribute('stroke-width', '1.5');
            bulb.setAttribute('class', 'light-indicator');
            bulb.style.cursor = 'pointer';

            if (light.on) {
                bulb.setAttribute('filter', 'url(#glow)');
            }

            // Tooltip
            const title = document.createElementNS(ns, 'title');
            title.textContent = `${light.name}: ${light.on ? 'ON' : 'OFF'} (double-click to toggle)`;
            bulb.appendChild(title);

            // Double-click to toggle light
            bulb.addEventListener('dblclick', () => {
                toggleLight(light.id, light.on, () => {
                    // Refresh after toggle
                    if (typeof loadLights === 'function') {
                        loadLights();
                    }
                });
            });

            group.appendChild(bulb);
        });

        container.appendChild(group);
    }
}

/**
 * Update outdoor lamppost visual state
 * @param {boolean} isOn - Whether outdoor lights are on
 */
function updateOutdoorLamppost(isOn) {
    const bulb = document.getElementById('lamp-bulb');
    const panel1 = document.getElementById('lamp-panel-1');
    const panel2 = document.getElementById('lamp-panel-2');
    const panelCenter = document.getElementById('lamp-panel-center');
    const lampHousing = document.getElementById('lamp-housing');

    if (!bulb) return;

    // Make lamppost clickable
    if (lampHousing) {
        lampHousing.style.cursor = 'pointer';
    }

    if (isOn) {
        // Light is ON - glow effect
        bulb.setAttribute('fill', '#FFD700');
        bulb.setAttribute('filter', 'url(#glow)');
        panel1.setAttribute('fill', '#FFF4CC');
        panel1.setAttribute('opacity', '0.9');
        panel2.setAttribute('fill', '#FFF4CC');
        panel2.setAttribute('opacity', '0.9');
        panelCenter.setAttribute('fill', '#FFEB99');
        panelCenter.setAttribute('opacity', '0.8');

        // Add light rays
        let rays = document.getElementById('lamp-rays');
        if (!rays) {
            const ns = 'http://www.w3.org/2000/svg';
            rays = document.createElementNS(ns, 'g');
            rays.setAttribute('id', 'lamp-rays');
            rays.setAttribute('opacity', '0.4');

            for (let i = 0; i < 8; i++) {
                const angle = (i * 45) * Math.PI / 180;
                const x1 = 155, y1 = 56;
                const x2 = 155 + Math.cos(angle) * 30;
                const y2 = 56 + Math.sin(angle) * 30;

                const ray = document.createElementNS(ns, 'line');
                ray.setAttribute('x1', x1);
                ray.setAttribute('y1', y1);
                ray.setAttribute('x2', x2);
                ray.setAttribute('y2', y2);
                ray.setAttribute('stroke', '#FFD700');
                ray.setAttribute('stroke-width', '2');
                ray.setAttribute('stroke-linecap', 'round');

                rays.appendChild(ray);
            }

            lampHousing.appendChild(rays);
        }
        rays.style.display = 'block';
    } else {
        // Light is OFF - dark
        bulb.setAttribute('fill', '#666');
        bulb.removeAttribute('filter');
        panel1.setAttribute('fill', '#1a1a1a');
        panel1.setAttribute('opacity', '0.3');
        panel2.setAttribute('fill', '#1a1a1a');
        panel2.setAttribute('opacity', '0.3');
        panelCenter.setAttribute('fill', '#1a1a1a');
        panelCenter.setAttribute('opacity', '0.2');

        const rays = document.getElementById('lamp-rays');
        if (rays) rays.style.display = 'none';
    }
}

/**
 * Setup lamppost click handler
 * @param {Function} onToggle - Callback when lamppost is double-clicked
 */
function setupLamppostClickHandler(onToggle) {
    const lampHousing = document.getElementById('lamp-housing');
    if (lampHousing) {
        lampHousing.addEventListener('dblclick', () => {
            if (roomLights['Outdoor'] && roomLights['Outdoor'].length > 0) {
                const outdoorLight = roomLights['Outdoor'][0];
                toggleLight(outdoorLight.id, outdoorLight.on, onToggle);
            }
        });
    }
}

/**
 * Check if outdoor lights are on
 * @returns {boolean} - True if any outdoor light is on
 */
function isOutdoorLightOn() {
    return roomLights['Outdoor'].some(light => light.on);
}

/**
 * Get room lights data
 * @returns {Object} - Room lights object
 */
function getRoomLights() {
    return roomLights;
}

// Export for ES6 modules
export {
    roomLights,
    mapLightToRoom,
    toggleLight,
    loadLights,
    updateLightIndicators,
    updateOutdoorLamppost,
    setupLamppostClickHandler,
    isOutdoorLightOn,
    getRoomLights,
    LIGHT_POSITIONS
};
