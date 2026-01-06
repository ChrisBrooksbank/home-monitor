/**
 * Home Monitor Application Entry Point
 * Initializes and coordinates all feature modules
 *
 * This is a hybrid approach that works with the existing global scripts
 * while the codebase is incrementally migrated to ES6 modules.
 */

(function() {
    'use strict';

    // =============================================================================
    // CONFIGURATION
    // =============================================================================

    const BRIDGE_IP = window.HUE_CONFIG?.BRIDGE_IP || '192.168.68.51';
    const USERNAME = window.HUE_CONFIG?.USERNAME || '';

    // Sensor mappings
    const sensorMapping = {
        'landing': 'temp-landing',
        'main bedroom': 'temp-main-bedroom',
        'guest room': 'temp-guest-bedroom',
        'Hue temperature sensor 1': 'temp-office',
        'bathroom': 'temp-bathroom',
        'Hall': 'temp-hall',
        'lounge': 'temp-lounge',
        'ExtensionDimmer': 'temp-extension',
        'KitchenSensor': 'temp-kitchen',
        'Hue outdoor temp. sensor 1': 'temp-outdoor'
    };

    const roomNames = {
        'landing': 'Landing',
        'main bedroom': 'Main Bedroom',
        'guest room': 'Guest Bedroom',
        'Hue temperature sensor 1': 'Home Office',
        'bathroom': 'Bathroom',
        'Hall': 'Hall',
        'lounge': 'Lounge',
        'ExtensionDimmer': 'Extension',
        'KitchenSensor': 'Kitchen',
        'Hue outdoor temp. sensor 1': 'Outdoor'
    };

    const roomColors = {
        'landing': '#FF6B9D',
        'main bedroom': '#FFB6C1',
        'guest room': '#DDA0DD',
        'Hue temperature sensor 1': '#87CEEB',
        'bathroom': '#4ECDC4',
        'Hall': '#95E1D3',
        'lounge': '#F4A460',
        'ExtensionDimmer': '#98D8C8',
        'KitchenSensor': '#FFB347',
        'Hue outdoor temp. sensor 1': '#7AE582'
    };

    // Room positions for thermometers
    const roomPositions = {
        'temp-main-bedroom': { x: 180, y: 220 },
        'temp-landing': { x: 340, y: 220 },
        'temp-office': { x: 500, y: 220 },
        'temp-bathroom': { x: 660, y: 220 },
        'temp-guest-bedroom': { x: 820, y: 220 },
        'temp-hall': { x: 200, y: 460 },
        'temp-lounge': { x: 400, y: 460 },
        'temp-kitchen': { x: 600, y: 460 },
        'temp-extension': { x: 800, y: 460 },
        'temp-outdoor': { x: 60, y: 10, isOutdoor: true }
    };

    // Light mapping patterns
    const lightMappings = {
        'outdoor|outside|garden': 'Outdoor',
        'guest': 'Guest Bedroom',
        'main bedroom|mainbedroom|^bedroomlight$|^bedroom$': 'Main Bedroom',
        'landing': 'Landing',
        'office': 'Home Office',
        'bathroom|bath': 'Bathroom',
        'lounge': 'Lounge',
        'hall': 'Hall',
        'extension': 'Extension',
        'kitchen': 'Kitchen'
    };

    // Motion sensor mappings
    const motionSensorMappings = {
        'outdoor|outside|garden': 'Outdoor',
        'hall|frontdoor|front door': 'Hall',
        'landing': 'Landing',
        'bathroom|bath': 'Bathroom'
    };

    // =============================================================================
    // STATE
    // =============================================================================

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

    const motionSensors = {
        'Outdoor': { detected: false, lastUpdated: null, previousDetected: false },
        'Hall': { detected: false, lastUpdated: null, previousDetected: false },
        'Landing': { detected: false, lastUpdated: null, previousDetected: false },
        'Bathroom': { detected: false, lastUpdated: null, previousDetected: false }
    };

    let tempHistory = {};
    let motionHistory = [];
    let sunriseTime = null;
    let sunsetTime = null;
    let previousLightStates = {};

    // =============================================================================
    // UTILITY FUNCTIONS
    // =============================================================================

    function mapLightToRoom(lightName) {
        if (!lightName) return null;
        const nameLower = lightName.toLowerCase();
        for (const [pattern, room] of Object.entries(lightMappings)) {
            if (new RegExp(pattern, 'i').test(nameLower)) {
                return room;
            }
        }
        return null;
    }

    function mapMotionSensorToRoom(sensorName) {
        if (!sensorName) return null;
        const nameLower = sensorName.toLowerCase();
        for (const [pattern, room] of Object.entries(motionSensorMappings)) {
            if (new RegExp(pattern, 'i').test(nameLower)) {
                return room;
            }
        }
        return null;
    }

    function getTemperatureColor(temp) {
        if (temp < 10) return '#4169E1';
        if (temp < 15) return '#00CED1';
        if (temp < 20) return '#32CD32';
        if (temp < 25) return '#FFA500';
        return '#FF4500';
    }

    // =============================================================================
    // HISTORY MANAGEMENT
    // =============================================================================

    function initTempHistory() {
        const stored = localStorage.getItem('tempHistory');
        if (stored) {
            tempHistory = JSON.parse(stored);
            const now = Date.now();
            const cutoff = now - (24 * 60 * 60 * 1000);
            for (let room in tempHistory) {
                tempHistory[room] = tempHistory[room].filter(entry => entry.time > cutoff);
            }
        }
    }

    function saveTempData(room, temp) {
        const now = Date.now();
        if (!tempHistory[room]) {
            tempHistory[room] = [];
        }
        tempHistory[room].push({ time: now, temp: parseFloat(temp) });
        const cutoff = now - (24 * 60 * 60 * 1000);
        tempHistory[room] = tempHistory[room].filter(entry => entry.time > cutoff);
        localStorage.setItem('tempHistory', JSON.stringify(tempHistory));
    }

    function initMotionHistory() {
        const stored = localStorage.getItem('motionHistory');
        if (stored) {
            motionHistory = JSON.parse(stored);
            const now = Date.now();
            const cutoff = now - (48 * 60 * 60 * 1000);
            motionHistory = motionHistory.filter(entry => entry.time > cutoff);
            localStorage.setItem('motionHistory', JSON.stringify(motionHistory));
        }
        updateMotionLogDisplay();
    }

    function logMotionEvent(room) {
        const now = Date.now();
        motionHistory.push({ type: 'motion', location: room, room: room, time: now });
        const cutoff = now - (48 * 60 * 60 * 1000);
        motionHistory = motionHistory.filter(entry => entry.time > cutoff);
        localStorage.setItem('motionHistory', JSON.stringify(motionHistory));
        updateMotionLogDisplay();
    }

    function updateMotionLogDisplay() {
        const logContainer = document.getElementById('motion-log');
        const countDisplay = document.getElementById('motion-log-count');
        if (!logContainer) return;

        if (countDisplay) countDisplay.textContent = motionHistory.length;

        if (motionHistory.length === 0) {
            logContainer.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">No motion events recorded yet</div>';
            return;
        }

        const sortedHistory = [...motionHistory].sort((a, b) => b.time - a.time);
        const groupedByDate = {};

        sortedHistory.forEach(entry => {
            const date = new Date(entry.time);
            const dateKey = date.toLocaleDateString();
            if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
            groupedByDate[dateKey].push(entry);
        });

        let html = '';
        for (const [dateKey, events] of Object.entries(groupedByDate)) {
            html += `<div style="margin-bottom: 15px;"><div style="font-weight: bold; margin-bottom: 8px;">📅 ${dateKey}</div>`;
            events.forEach(entry => {
                const date = new Date(entry.time);
                const timeStr = date.toLocaleTimeString();
                const roomEmoji = { 'Outdoor': '🌳', 'Hall': '🚪', 'Landing': '🪜', 'Bathroom': '🚿' };
                const emoji = roomEmoji[entry.room] || '🚶';
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

    function announceMotion(room) {
        if (!('speechSynthesis' in window)) return;
        const messages = {
            'Outdoor': 'Motion detected outside',
            'Hall': 'Motion detected in the hall',
            'Landing': 'Motion detected on the landing',
            'Bathroom': 'Motion detected in the bathroom'
        };
        const utterance = new SpeechSynthesisUtterance();
        utterance.text = messages[room] || `Motion detected in ${room}`;
        utterance.rate = 1.1;
        utterance.volume = 1.0;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    }

    function announceLight(room, isOn) {
        if (window.effectInProgress) return;
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

    function createThermometer(elementId, temp, roomName) {
        const position = roomPositions[elementId];
        if (!position) return null;

        const ns = 'http://www.w3.org/2000/svg';
        const group = document.createElementNS(ns, 'g');
        group.setAttribute('class', 'thermometer');
        group.setAttribute('data-room', elementId);

        const tubeWidth = 24, tubeHeight = 80, bulbRadius = 16;

        // Tube
        const tube = document.createElementNS(ns, 'rect');
        tube.setAttribute('x', 0); tube.setAttribute('y', 0);
        tube.setAttribute('width', tubeWidth); tube.setAttribute('height', tubeHeight);
        tube.setAttribute('rx', 12);
        tube.setAttribute('fill', 'rgba(255, 255, 255, 0.9)');
        tube.setAttribute('stroke', '#666'); tube.setAttribute('stroke-width', '2');
        group.appendChild(tube);

        // Bulb
        const bulb = document.createElementNS(ns, 'circle');
        bulb.setAttribute('cx', tubeWidth / 2);
        bulb.setAttribute('cy', tubeHeight + bulbRadius - 4);
        bulb.setAttribute('r', bulbRadius);
        bulb.setAttribute('fill', 'rgba(255, 255, 255, 0.9)');
        bulb.setAttribute('stroke', '#666'); bulb.setAttribute('stroke-width', '2');
        group.appendChild(bulb);

        // Mercury
        const percentage = Math.max(0, Math.min(1, temp / 30));
        const mercuryColor = position.isOutdoor ? '#00CED1' : getTemperatureColor(temp);

        const mercuryBulb = document.createElementNS(ns, 'circle');
        mercuryBulb.setAttribute('cx', tubeWidth / 2);
        mercuryBulb.setAttribute('cy', tubeHeight + bulbRadius - 4);
        mercuryBulb.setAttribute('r', bulbRadius - 4);
        mercuryBulb.setAttribute('fill', mercuryColor);
        group.appendChild(mercuryBulb);

        const mercuryHeight = (tubeHeight - 10) * percentage;
        const mercuryTube = document.createElementNS(ns, 'rect');
        mercuryTube.setAttribute('x', tubeWidth / 2 - 4);
        mercuryTube.setAttribute('y', tubeHeight - mercuryHeight);
        mercuryTube.setAttribute('width', 8);
        mercuryTube.setAttribute('height', mercuryHeight + bulbRadius);
        mercuryTube.setAttribute('rx', 4);
        mercuryTube.setAttribute('fill', mercuryColor);
        group.appendChild(mercuryTube);

        // Temperature text
        const tempText = document.createElementNS(ns, 'text');
        tempText.setAttribute('x', tubeWidth / 2);
        tempText.setAttribute('y', tubeHeight + bulbRadius * 2 + 20);
        tempText.setAttribute('text-anchor', 'middle');
        tempText.setAttribute('font-size', '18');
        tempText.setAttribute('font-weight', '700');
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
        label.setAttribute('font-weight', '600');
        label.setAttribute('fill', position.isOutdoor ? '#0066CC' : '#333');
        label.textContent = roomName;
        group.appendChild(label);

        group.setAttribute('transform', `translate(${position.x}, ${position.y})`);

        const containerId = position.isOutdoor ? 'outdoor-thermometer-container' : 'thermometers-container';
        const container = document.getElementById(containerId);
        if (container) container.appendChild(group);

        return tempText;
    }

    function createSparkles(element) {
        if (!element) return;
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        for (let i = 0; i < 8; i++) {
            const sparkle = document.createElement('div');
            sparkle.className = 'sparkle-star';
            sparkle.textContent = ['✨', '⭐', '🌟', '💫'][Math.floor(Math.random() * 4)];
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

    async function loadTemperatures(showSparkles = true) {
        try {
            const response = await fetch(`http://${BRIDGE_IP}/api/${USERNAME}/sensors`);
            if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
            const sensors = await response.json();

            document.getElementById('thermometers-container').innerHTML = '';
            document.getElementById('outdoor-thermometer-container').innerHTML = '';

            const temps = [];
            for (const [id, sensor] of Object.entries(sensors)) {
                if (sensor.type === 'ZLLTemperature') {
                    const elementId = sensorMapping[sensor.name];
                    if (elementId && sensor.state.temperature != null) {
                        const tempC = (sensor.state.temperature / 100.0).toFixed(1);
                        const roomName = roomNames[sensor.name] || sensor.name;
                        const tempElement = createThermometer(elementId, parseFloat(tempC), roomName);
                        saveTempData(sensor.name, tempC);
                        if (tempElement && showSparkles) {
                            setTimeout(() => createSparkles(tempElement), 100);
                        }
                        if (sensor.name !== 'Hue outdoor temp. sensor 1') {
                            temps.push(parseFloat(tempC));
                        }
                    }
                }
            }

            const lastUpdateEl = document.getElementById('lastUpdate');
            if (lastUpdateEl) {
                lastUpdateEl.textContent = `Last updated: ${new Date().toLocaleString()} ✨`;
            }
        } catch (error) {
            Logger.error('Error loading temperatures:', error);
        }
    }

    async function loadLights() {
        try {
            const response = await fetch(`http://${BRIDGE_IP}/api/${USERNAME}/lights`);
            if (!response.ok) return;
            const lights = await response.json();

            for (let room in roomLights) roomLights[room] = [];

            for (const [id, light] of Object.entries(lights)) {
                const room = mapLightToRoom(light.name);
                if (room && roomLights[room]) {
                    const currentState = light.state.on;
                    if (previousLightStates[id] !== undefined &&
                        previousLightStates[id] !== currentState &&
                        light.state.reachable) {
                        announceLight(room, currentState);
                    }
                    previousLightStates[id] = currentState;
                    roomLights[room].push({
                        id, name: light.name, on: currentState, reachable: light.state.reachable
                    });
                }
            }

            updateLightIndicators();
            updateOutdoorLamppost();
        } catch (error) {
            Logger.error('Error loading lights:', error);
        }
    }

    async function loadMotionSensors() {
        try {
            const response = await fetch(`http://${BRIDGE_IP}/api/${USERNAME}/sensors`);
            if (!response.ok) return;
            const sensors = await response.json();

            for (const [id, sensor] of Object.entries(sensors)) {
                if (sensor.type === 'ZLLPresence') {
                    const room = mapMotionSensorToRoom(sensor.name);
                    if (room && motionSensors[room]) {
                        const wasDetected = motionSensors[room].detected;
                        motionSensors[room].detected = sensor.state.presence;
                        motionSensors[room].lastUpdated = new Date();

                        if (sensor.state.presence && !wasDetected) {
                            logMotionEvent(room);
                            announceMotion(room);
                        }
                        motionSensors[room].previousDetected = wasDetected;
                    }
                }
            }
        } catch (error) {
            Logger.error('Error loading motion sensors:', error);
        }
    }

    // =============================================================================
    // LIGHT UI
    // =============================================================================

    function updateLightIndicators() {
        const positions = {
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

        const container = document.getElementById('light-indicators-container');
        if (!container) return;
        container.innerHTML = '';

        const ns = 'http://www.w3.org/2000/svg';
        for (const [room, lights] of Object.entries(roomLights)) {
            if (lights.length === 0) continue;
            const pos = positions[room];
            if (!pos) continue;

            const group = document.createElementNS(ns, 'g');
            lights.forEach((light, i) => {
                const offsetX = (i - (lights.length - 1) / 2) * 20;
                const bulb = document.createElementNS(ns, 'circle');
                bulb.setAttribute('cx', pos.x + offsetX);
                bulb.setAttribute('cy', pos.y);
                bulb.setAttribute('r', 6);
                bulb.setAttribute('fill', light.on ? '#FFD700' : '#666');
                bulb.setAttribute('stroke', light.on ? '#FFA500' : '#333');
                bulb.setAttribute('stroke-width', '1.5');
                bulb.style.cursor = 'pointer';
                if (light.on) bulb.setAttribute('filter', 'url(#glow)');

                const title = document.createElementNS(ns, 'title');
                title.textContent = `${light.name}: ${light.on ? 'ON' : 'OFF'} (double-click to toggle)`;
                bulb.appendChild(title);

                bulb.addEventListener('dblclick', () => toggleLight(light.id, light.on));
                group.appendChild(bulb);
            });
            container.appendChild(group);
        }
    }

    function updateOutdoorLamppost() {
        const outdoorLightsOn = roomLights['Outdoor'].some(l => l.on);
        const bulb = document.getElementById('lamp-bulb');
        if (!bulb) return;

        if (outdoorLightsOn) {
            bulb.setAttribute('fill', '#FFD700');
            bulb.setAttribute('filter', 'url(#glow)');
        } else {
            bulb.setAttribute('fill', '#666');
            bulb.removeAttribute('filter');
        }
    }

    async function toggleLight(lightId, currentState) {
        try {
            const response = await fetch(
                `http://${BRIDGE_IP}/api/${USERNAME}/lights/${lightId}/state`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ on: !currentState })
                }
            );
            if (response.ok) {
                setTimeout(loadLights, 500);
            }
        } catch (error) {
            Logger.error('Error toggling light:', error);
        }
    }

    // =============================================================================
    // SKY & WEATHER
    // =============================================================================

    async function fetchSunTimes() {
        try {
            const response = await fetch(
                'https://api.sunrise-sunset.org/json?lat=51.7356&lng=0.4685&formatted=0'
            );
            const data = await response.json();
            if (data.status === 'OK') {
                sunriseTime = new Date(data.results.sunrise);
                sunsetTime = new Date(data.results.sunset);
                Logger.info(`Sunrise: ${sunriseTime.toLocaleTimeString()}, Sunset: ${sunsetTime.toLocaleTimeString()}`);
                updateSky();
            }
        } catch (error) {
            Logger.error('Error fetching sun times:', error);
            const now = new Date();
            sunriseTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0);
            sunsetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0);
        }
    }

    function updateSky() {
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

        let config;
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

        if (sun) sun.style.display = config.sun ? 'block' : 'none';
        if (moon) moon.style.display = config.moon ? 'block' : 'none';
        if (stars) stars.style.display = config.stars ? 'block' : 'none';
    }

    async function updateWeatherDisplay() {
        const apiKey = window.WEATHER_CONFIG?.API_KEY;
        if (!apiKey || apiKey === 'YOUR-WEATHERAPI-KEY-HERE') return;

        try {
            const response = await fetch(
                `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=Chelmsford,UK`
            );
            if (!response.ok) return;
            const data = await response.json();

            const els = {
                'weather-temp-svg': `${Math.round(data.current.temp_c)}°`,
                'weather-condition-svg': data.current.condition.text,
                'weather-humidity-svg': `${data.current.humidity}%`,
                'weather-uv-svg': `UV ${data.current.uv}`
            };

            for (const [id, val] of Object.entries(els)) {
                const el = document.getElementById(id);
                if (el) el.textContent = val;
            }

            Logger.info(`Weather: ${data.current.temp_c}°C, ${data.current.condition.text}`);
        } catch (error) {
            Logger.error('Error fetching weather:', error);
        }
    }

    // =============================================================================
    // INITIALIZATION
    // =============================================================================

    function init() {
        Logger.info('Initializing Home Monitor (app.js)...');

        // Initialize history
        initTempHistory();
        initMotionHistory();

        // Initial data load
        loadTemperatures();
        loadLights();
        loadMotionSensors();
        fetchSunTimes();
        updateWeatherDisplay();

        // Setup lamppost click
        const lampHousing = document.getElementById('lamp-housing');
        if (lampHousing) {
            lampHousing.style.cursor = 'pointer';
            lampHousing.addEventListener('dblclick', () => {
                if (roomLights['Outdoor'] && roomLights['Outdoor'].length > 0) {
                    toggleLight(roomLights['Outdoor'][0].id, roomLights['Outdoor'][0].on);
                }
            });
        }

        // Register polling intervals
        IntervalManager.register(loadMotionSensors, APP_CONFIG.intervals.motionSensors);
        IntervalManager.register(loadLights, APP_CONFIG.intervals.lights);
        IntervalManager.register(() => loadTemperatures(false), APP_CONFIG.intervals.temperatures);
        IntervalManager.register(updateMotionLogDisplay, APP_CONFIG.intervals.motionLog);
        IntervalManager.register(updateSky, APP_CONFIG.intervals.sky);
        IntervalManager.register(fetchSunTimes, APP_CONFIG.intervals.sunTimes);
        IntervalManager.register(updateWeatherDisplay, APP_CONFIG.intervals.weather);

        Logger.success('Home Monitor initialized!');
    }

    // Expose to window
    window.HomeMonitor = {
        init,
        loadTemperatures,
        loadLights,
        loadMotionSensors,
        updateWeatherDisplay,
        toggleLight
    };

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
