        // ============================================================================
        // HOUSE CONFIGURATION - Edit these values to personalize for your home
        // ============================================================================
        const HOUSE_CONFIG = {
            // House Information
            address: '28 Barn Green',

            // Network & Device IPs
            devices: {
                hueBridge: HUE_CONFIG.BRIDGE_IP,
                hueUsername: HUE_CONFIG.USERNAME,
                googleHub: '192.168.68.62',
                nest: null,  // Set if using Nest integration

                // Sonos Speakers (add/remove as needed)
                sonos: {
                    bedroom: '192.168.68.61',
                    office: '192.168.68.75',
                    lounge: '192.168.68.64'
                },

                // Tapo Smart Plugs (TP-Link P105 etc.)
                tapo: {
                    tree: { ip: '192.168.68.77', room: 'Extension', label: 'Tree Lights', x: 800, y: 410 },
                    winter: { ip: '192.168.68.72', room: 'Extension', label: 'Winter Lights', x: 690, y: 410 },
                    extension: { ip: '192.168.68.80', room: 'Extension', label: 'Extension Plug', x: 580, y: 410 }
                }
            },

            // Room Definitions
            rooms: [
                'Main Bedroom',
                'Guest Bedroom',
                'Bathroom',
                'Landing',
                'Hall',
                'Home Office',
                'Lounge',
                'Kitchen',
                'Extension',
                'Outdoor'
            ],

            // Light Name to Room Mapping Rules
            // Maps keywords found in light names to room names
            lightMappings: {
                // Pattern: [keywords to match in light name, room name]
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
            },

            // Motion Sensor Name to Room Mapping Rules
            motionSensorMappings: {
                'outdoor|outside|garden': 'Outdoor',
                'hall|frontdoor|front door': 'Hall',
                'landing': 'Landing',
                'bathroom|bath': 'Bathroom'
            },

            // Temperature Sensor Locations (SVG coordinates)
            tempSensorPositions: {
                'temp-bedroom': { x: 700, y: 300, isOutdoor: false },
                'temp-office': { x: 515, y: 290, isOutdoor: false },
                'temp-lounge': { x: 400, y: 480, isOutdoor: false },
                'temp-outdoor': { x: 60, y: 10, isOutdoor: true }
            }
        };

        // Legacy constants for backward compatibility
        const BRIDGE_IP = HOUSE_CONFIG.devices.hueBridge;
        const USERNAME = HOUSE_CONFIG.devices.hueUsername;

        const sensorMapping = {
            // First Floor
            'landing': 'temp-landing',
            'main bedroom': 'temp-main-bedroom',
            'guest room': 'temp-guest-bedroom',
            'Hue temperature sensor 1': 'temp-office',  // Home Office
            'bathroom': 'temp-bathroom',
            // Ground Floor
            'Hall': 'temp-hall',
            'lounge': 'temp-lounge',
            'ExtensionDimmer': 'temp-extension',
            'guest room': 'temp-guest-bedroom',
            'KitchenSensor': 'temp-kitchen',
            // Outdoor
            'Hue outdoor temp. sensor 1': 'temp-outdoor'
        };

        const roomColors = {
            // First Floor
            'landing': '#FF6B9D',
            'main bedroom': '#FFB6C1',
            'guest room': '#DDA0DD',
            'Hue temperature sensor 1': '#87CEEB',
            'bathroom': '#4ECDC4',
            // Ground Floor
            'Hall': '#95E1D3',
            'lounge': '#F4A460',
            'ExtensionDimmer': '#98D8C8',
            'KitchenSensor': '#FFB347',
            // Outdoor
            'Hue outdoor temp. sensor 1': '#7AE582'
        };

        const roomNames = {
            // First Floor
            'landing': 'Landing',
            'main bedroom': 'Main Bedroom',
            'guest room': 'Guest Bedroom',
            'Hue temperature sensor 1': 'Home Office',
            'bathroom': 'Bathroom',
            // Ground Floor
            'Hall': 'Hall',
            'lounge': 'Lounge',
            'ExtensionDimmer': 'Extension',
            'KitchenSensor': 'Kitchen',
            // Outdoor
            'Hue outdoor temp. sensor 1': 'Outdoor'
        };

        // Light bulb mapping to rooms (will be populated dynamically)
        const lightMapping = {};

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

        // Store motion sensor states
        const motionSensors = {
            'Outdoor': { detected: false, lastUpdated: null, previousDetected: false },
            'Hall': { detected: false, lastUpdated: null, previousDetected: false },
            'Landing': { detected: false, lastUpdated: null, previousDetected: false },
            'Bathroom': { detected: false, lastUpdated: null, previousDetected: false }
        };

        // Motion detection history (48 hours)
        let motionHistory = [];

        // Initialize motion history from localStorage
        function initMotionHistory() {
            const stored = localStorage.getItem('motionHistory');
            if (stored) {
                motionHistory = JSON.parse(stored);
                // Clean old data (older than 48 hours)
                const now = Date.now();
                const twoDaysAgo = now - (48 * 60 * 60 * 1000);
                motionHistory = motionHistory.filter(entry => entry.time > twoDaysAgo);
                localStorage.setItem('motionHistory', JSON.stringify(motionHistory));
            }
            updateMotionLogDisplay();
        }

        // Log a motion detection event
        function logMotionEvent(room) {
            logActivityEvent('motion', room, null);
        }

        // Log a light on/off event
        function logLightEvent(lightName, isOn) {
            logActivityEvent('light', lightName, isOn ? 'on' : 'off');
        }

        // Log a thermostat temperature change
        function logThermostatEvent(targetTemp) {
            logActivityEvent('thermostat', 'Main Bedroom', `${targetTemp}°C`);
        }

        // General activity logging function
        function logActivityEvent(type, location, detail) {
            const now = Date.now();
            motionHistory.push({
                type: type,           // 'motion', 'light', 'thermostat'
                location: location,   // room name or light name
                detail: detail,       // additional info (e.g., 'on', 'off', '21°C')
                time: now,
                room: location        // Keep for backwards compatibility with old motion entries
            });

            // Keep only last 48 hours
            const twoDaysAgo = now - (48 * 60 * 60 * 1000);
            motionHistory = motionHistory.filter(entry => entry.time > twoDaysAgo);

            // Save to localStorage
            localStorage.setItem('motionHistory', JSON.stringify(motionHistory));

            // Update display
            updateMotionLogDisplay();
        }

        // Update the motion log display
        function updateMotionLogDisplay() {
            const logContainer = document.getElementById('motion-log');
            const countDisplay = document.getElementById('motion-log-count');

            if (!logContainer) return;

            // Get colors from CSS variables
            const styles = getComputedStyle(document.documentElement);
            const textLight = styles.getPropertyValue('--text-light').trim();
            const textPrimary = styles.getPropertyValue('--text-primary').trim();

            // Count display
            countDisplay.textContent = motionHistory.length;

            if (motionHistory.length === 0) {
                logContainer.innerHTML = `<div style="text-align: center; color: ${textLight}; padding: 20px;">No motion events recorded yet</div>`;
                return;
            }

            // Sort by most recent first
            const sortedHistory = [...motionHistory].sort((a, b) => b.time - a.time);

            // Group by date
            const groupedByDate = {};
            sortedHistory.forEach(entry => {
                const date = new Date(entry.time);
                const dateKey = date.toLocaleDateString();
                if (!groupedByDate[dateKey]) {
                    groupedByDate[dateKey] = [];
                }
                groupedByDate[dateKey].push(entry);
            });

            // Build HTML
            let html = '';
            for (const [dateKey, events] of Object.entries(groupedByDate)) {
                html += `<div style="margin-bottom: 15px;">`;
                html += `<div style="font-weight: bold; color: ${textPrimary}; margin-bottom: 8px; font-family: 'Fredoka', sans-serif;">📅 ${dateKey}</div>`;

                events.forEach(entry => {
                    const date = new Date(entry.time);
                    const timeStr = date.toLocaleTimeString();

                    // Determine event type (backwards compatible with old motion-only entries)
                    const eventType = entry.type || 'motion';
                    let emoji, description, borderColor;

                    if (eventType === 'motion') {
                        const roomEmoji = {
                            'Outdoor': '🌳',
                            'Hall': '🚪',
                            'Landing': '🪜',
                            'Bathroom': '🚿'
                        };
                        emoji = roomEmoji[entry.room || entry.location] || '🚶';
                        description = `<strong>${entry.room || entry.location}</strong> motion`;
                        borderColor = '#FF6B35';
                    } else if (eventType === 'light') {
                        emoji = entry.detail === 'on' ? '💡' : '🌙';
                        description = `<strong>${entry.location}</strong> turned ${entry.detail}`;
                        borderColor = entry.detail === 'on' ? '#FFD700' : '#4A5568';
                    } else if (eventType === 'thermostat') {
                        emoji = '🌡️';
                        description = `<strong>${entry.location}</strong> set to ${entry.detail}`;
                        borderColor = '#FF6B6B';
                    } else {
                        emoji = '📝';
                        description = `${entry.location}`;
                        borderColor = textPrimary;
                    }

                    // Calculate how long ago
                    const now = Date.now();
                    const diff = now - entry.time;
                    const hours = Math.floor(diff / (60 * 60 * 1000));
                    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
                    let ago = '';
                    if (hours > 0) {
                        ago = `${hours}h ${minutes}m ago`;
                    } else if (minutes > 0) {
                        ago = `${minutes}m ago`;
                    } else {
                        ago = 'just now';
                    }

                    html += `<div style="padding: 6px 10px; margin: 4px 0; background: ${styles.getPropertyValue('--bg-graph').trim()}; border-radius: 6px; border-left: 3px solid ${borderColor}; display: flex; justify-content: space-between; align-items: center;">`;
                    html += `<span style="color: ${textPrimary};">${emoji} ${description} - ${timeStr}</span>`;
                    html += `<span style="color: ${textLight}; font-size: 11px;">${ago}</span>`;
                    html += `</div>`;
                });

                html += `</div>`;
            }

            logContainer.innerHTML = html;

            // Auto-scroll to top (most recent)
            logContainer.scrollTop = 0;
        }

        // Voice announcement function for motion
        function announceMotion(room) {
            // Use Web Speech API for local voice announcement
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance();

                // Different messages for different locations
                const messages = {
                    'Outdoor': 'Motion detected outside',
                    'Hall': 'Motion detected in the hall',
                    'Landing': 'Motion detected on the landing',
                    'Bathroom': 'Motion detected in the bathroom'
                };

                utterance.text = messages[room] || `Motion detected in ${room}`;
                utterance.rate = 1.1; // Slightly faster for urgency
                utterance.pitch = 1.0;
                utterance.volume = 1.0;

                // Cancel any ongoing speech and speak
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(utterance);
            } else {
                // Fallback: play a beep sound if speech not available
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);

                oscillator.frequency.value = 800;
                oscillator.type = 'sine';

                gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

                oscillator.start(audioContext.currentTime);
                oscillator.stop(audioContext.currentTime + 0.5);
            }
        }

        // Voice announcement function for lights
        function announceLight(room, isOn) {
            // Don't announce during light effects to avoid spam
            if (effectInProgress) {
                return;
            }

            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance();

                const action = isOn ? 'on' : 'off';
                const roomName = room.toLowerCase();

                utterance.text = `${room} light turned ${action}`;
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                utterance.volume = 0.8;

                // Don't cancel ongoing speech, queue it instead
                window.speechSynthesis.speak(utterance);
            }
        }

        // Temperature history storage
        let tempHistory = {};

        function initTempHistory() {
            const stored = localStorage.getItem('tempHistory');
            if (stored) {
                tempHistory = JSON.parse(stored);
                // Clean old data (older than 24 hours)
                const now = Date.now();
                const oneDayAgo = now - (24 * 60 * 60 * 1000);
                for (let room in tempHistory) {
                    tempHistory[room] = tempHistory[room].filter(entry => entry.time > oneDayAgo);
                }
            } else {
                for (let room in sensorMapping) {
                    tempHistory[room] = [];
                }
            }
        }

        function saveTempData(room, temp) {
            const now = Date.now();
            if (!tempHistory[room]) {
                tempHistory[room] = [];
            }
            tempHistory[room].push({ time: now, temp: parseFloat(temp) });

            // Keep only last 24 hours
            const oneDayAgo = now - (24 * 60 * 60 * 1000);
            tempHistory[room] = tempHistory[room].filter(entry => entry.time > oneDayAgo);

            localStorage.setItem('tempHistory', JSON.stringify(tempHistory));
        }

        function drawGraph() {
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
            const oneDayAgo = now - (24 * 60 * 60 * 1000);

            // Graph dimensions
            const width = 1100;
            const height = 300;
            const marginLeft = 50;
            const marginBottom = 50;

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
                minTemp = 0;
                maxTemp = 30;
            } else {
                minTemp = Math.floor(minTemp) - 2;
                maxTemp = Math.ceil(maxTemp) + 2;
            }

            // Draw grid lines
            const tempRange = maxTemp - minTemp;
            for (let i = 0; i <= 5; i++) {
                const temp = minTemp + (tempRange * i / 5);
                const y = 350 - (temp - minTemp) / tempRange * height;

                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', marginLeft);
                line.setAttribute('y1', y);
                line.setAttribute('x2', marginLeft + width);
                line.setAttribute('y2', y);
                line.setAttribute('stroke', '#e0e0e0');
                line.setAttribute('stroke-width', '1');
                line.setAttribute('stroke-dasharray', '5,5');
                gridLines.appendChild(line);

                const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                label.setAttribute('x', marginLeft - 10);
                label.setAttribute('y', y + 5);
                label.setAttribute('text-anchor', 'end');
                label.setAttribute('font-size', '12');
                label.setAttribute('fill', '#666');
                label.textContent = temp.toFixed(1) + '°C';
                axisLabels.appendChild(label);
            }

            // Draw time labels (every 4 hours)
            for (let i = 0; i <= 6; i++) {
                const time = oneDayAgo + (24 * 60 * 60 * 1000 * i / 6);
                const x = marginLeft + (width * i / 6);
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

            // Draw lines for each room
            let legendY = 70;
            for (let room in tempHistory) {
                const data = tempHistory[room];
                if (data.length < 2) continue;

                const color = roomColors[room] || '#999';
                const points = [];

                data.forEach(entry => {
                    const x = marginLeft + ((entry.time - oneDayAgo) / (24 * 60 * 60 * 1000)) * width;
                    const y = 350 - ((entry.temp - minTemp) / tempRange) * height;
                    points.push(`${x},${y}`);
                });

                const pathData = 'M' + points.join(' L');
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', pathData);
                path.setAttribute('class', 'graph-line');
                path.setAttribute('stroke', color);

                // Calculate path length for animation
                const pathLength = path.getTotalLength();
                path.style.strokeDasharray = pathLength;
                path.style.strokeDashoffset = pathLength;
                path.style.animation = `draw-line 2s ease-out forwards`;

                graphLines.appendChild(path);

                // Draw points
                data.forEach(entry => {
                    const x = marginLeft + ((entry.time - oneDayAgo) / (24 * 60 * 60 * 1000)) * width;
                    const y = 350 - ((entry.temp - minTemp) / tempRange) * height;

                    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    circle.setAttribute('cx', x);
                    circle.setAttribute('cy', y);
                    circle.setAttribute('r', 4);
                    circle.setAttribute('fill', color);
                    circle.setAttribute('class', 'graph-point');
                    circle.style.opacity = 0;
                    circle.style.animation = `fade-in 0.5s ease-out ${2 + (x / width) * 0.5}s forwards`;

                    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
                    const date = new Date(entry.time);
                    title.textContent = `${roomNames[room]}: ${entry.temp}°C at ${date.toLocaleTimeString()}`;
                    circle.appendChild(title);

                    graphLines.appendChild(circle);
                });

                // Legend
                const legendRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                legendRect.setAttribute('x', 900);
                legendRect.setAttribute('y', legendY - 10);
                legendRect.setAttribute('width', 20);
                legendRect.setAttribute('height', 4);
                legendRect.setAttribute('fill', color);
                legend.appendChild(legendRect);

                const legendText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                legendText.setAttribute('x', 930);
                legendText.setAttribute('y', legendY);
                legendText.setAttribute('font-size', '14');
                legendText.setAttribute('font-weight', '600');
                legendText.setAttribute('fill', '#333');
                legendText.setAttribute('font-family', 'Fredoka');
                legendText.textContent = roomNames[room];
                legend.appendChild(legendText);

                legendY += 25;
            }

            // Add fade-in animation for points
            if (!document.getElementById('fade-in-style')) {
                const style = document.createElement('style');
                style.id = 'fade-in-style';
                style.textContent = `
                    @keyframes fade-in {
                        to { opacity: 1; }
                    }
                `;
                document.head.appendChild(style);
            }
        }

        // Room positions for thermometers (bulb positioned inside each room)
        const roomPositions = {
            // First Floor (y: 200-350) - bulbs near bottom of rooms
            'temp-main-bedroom': { x: 180, y: 220 },
            'temp-landing': { x: 340, y: 220 },
            'temp-office': { x: 500, y: 220 },
            'temp-bathroom': { x: 660, y: 220 },
            'temp-guest-bedroom': { x: 820, y: 220 },
            // Ground Floor (y: 350-600) - bulbs in middle/lower section
            'temp-hall': { x: 200, y: 460 },
            'temp-lounge': { x: 400, y: 460 },
            'temp-kitchen': { x: 600, y: 460 },
            'temp-extension': { x: 800, y: 460 },
            // Outdoor (relative to outdoor-area transform)
            'temp-outdoor': { x: 60, y: 10, isOutdoor: true }
        };

        // Load custom thermometer positions from localStorage
        let customThermometerPositions = JSON.parse(
            localStorage.getItem('thermometerPositions') || '{}'
        );

        // Get position with custom override support
        function getThermometerPosition(elementId) {
            return customThermometerPositions[elementId] || roomPositions[elementId];
        }

        function getTemperatureColor(temp) {
            if (temp < 10) return '#4169E1';  // Royal Blue - Cold
            if (temp < 15) return '#00CED1';  // Dark Turquoise - Cool
            if (temp < 20) return '#32CD32';  // Lime Green - Comfortable
            if (temp < 25) return '#FFA500';  // Orange - Warm
            return '#FF4500';  // Orange Red - Hot
        }

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
            if (position.isOutdoor) {
                group.setAttribute('transform', `translate(${position.x}, ${position.y})`);
                document.getElementById('outdoor-thermometer-container').appendChild(group);
            } else {
                group.setAttribute('transform', `translate(${position.x}, ${position.y})`);
                document.getElementById('thermometers-container').appendChild(group);
            }

            // Make thermometer draggable
            makeDraggable(group, elementId, position);

            return tempText;
        }

        function loadSavedPosition(element, storageKey) {
            if (!element) return;
            const savedPosition = localStorage.getItem(storageKey);
            if (savedPosition) {
                const position = JSON.parse(savedPosition);
                // Preserve any existing scale/rotate in the transform
                const currentTransform = element.getAttribute('transform') || '';
                const scaleMatch = currentTransform.match(/scale\([^)]+\)/);
                const rotateMatch = currentTransform.match(/rotate\([^)]+\)/);

                let newTransform = `translate(${position.x}, ${position.y})`;
                if (scaleMatch) newTransform += ` ${scaleMatch[0]}`;
                if (rotateMatch) newTransform += ` ${rotateMatch[0]}`;

                element.setAttribute('transform', newTransform);
            }
        }

        // Generic draggable factory function
        function createDraggable(element, options = {}) {
            const {
                storageKey,
                excludeSelector = null,
                cursor = 'move',
                activeCursor = null,
                onStart = null,
                onMove = null,
                onEnd = null,
                customSave = null
            } = options;

            let isDragging = false;
            let startX, startY, currentTransform;

            // Set default cursor
            if (typeof cursor === 'string') {
                element.style.cursor = cursor;
            }

            function handleStart(e) {
                // Skip if clicking on excluded elements
                if (excludeSelector && e.target.closest(excludeSelector)) {
                    return;
                }

                // Call custom onStart if provided (can return false to cancel)
                if (onStart && onStart(e) === false) {
                    return;
                }

                isDragging = true;

                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;

                startX = clientX;
                startY = clientY;

                const transform = element.getAttribute('transform') || '';
                const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                currentTransform = {
                    x: parseFloat(match[1]),
                    y: parseFloat(match[2]),
                    // Preserve any scale/rotate transforms
                    scale: transform.match(/scale\([^)]+\)/)?.[0] || '',
                    rotate: transform.match(/rotate\([^)]+\)/)?.[0] || ''
                };

                element.style.opacity = '0.7';
                if (activeCursor) {
                    element.style.cursor = activeCursor;
                }

                e.preventDefault();
                e.stopPropagation();
            }

            function handleMove(e) {
                if (!isDragging) return;

                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;

                const dx = clientX - startX;
                const dy = clientY - startY;

                // Call custom onMove if provided
                if (onMove) {
                    onMove({ dx, dy, clientX, clientY, startX, startY, currentTransform, element });
                } else {
                    // Default behavior: update position while preserving scale/rotate
                    const newX = currentTransform.x + dx;
                    const newY = currentTransform.y + dy;
                    let newTransform = `translate(${newX}, ${newY})`;
                    if (currentTransform.scale) newTransform += ` ${currentTransform.scale}`;
                    if (currentTransform.rotate) newTransform += ` ${currentTransform.rotate}`;
                    element.setAttribute('transform', newTransform);
                }
            }

            function handleEnd(e) {
                if (!isDragging) return;
                isDragging = false;

                element.style.opacity = '1';
                if (activeCursor) {
                    element.style.cursor = cursor;
                }

                // Call custom onEnd or save if provided
                if (onEnd) {
                    onEnd(e, element);
                } else if (customSave) {
                    customSave(element);
                } else if (storageKey) {
                    // Default save behavior
                    const transform = element.getAttribute('transform');
                    const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                    const position = {
                        x: parseFloat(match[1]),
                        y: parseFloat(match[2])
                    };
                    localStorage.setItem(storageKey, JSON.stringify(position));
                }
            }

            // Add event listeners
            element.addEventListener('mousedown', handleStart);
            element.addEventListener('touchstart', handleStart, { passive: false });

            document.addEventListener('mousemove', handleMove);
            document.addEventListener('touchmove', handleMove, { passive: false });

            document.addEventListener('mouseup', handleEnd);
            document.addEventListener('touchend', handleEnd);
        }

        function makeDraggable(group, elementId, position) {
            createDraggable(group, {
                cursor: 'move',
                customSave: (element) => {
                    const transform = element.getAttribute('transform');
                    const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                    customThermometerPositions[elementId] = {
                        x: parseFloat(match[1]),
                        y: parseFloat(match[2]),
                        isOutdoor: position.isOutdoor
                    };
                    localStorage.setItem('thermometerPositions', JSON.stringify(customThermometerPositions));
                }
            });
        }

        function resetThermometerPositions() {
            if (confirm('Reset all thermometer positions to defaults?')) {
                localStorage.removeItem('thermometerPositions');
                location.reload();
            }
        }

        function createSparkles(element) {
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const sparkleEmojis = ['✨', '⭐', '🌟', '💫', '✨', '⭐'];
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

        function mapLightToRoom(lightName) {
            const nameLower = lightName.toLowerCase();

            // Check each mapping pattern from config
            for (const [pattern, room] of Object.entries(HOUSE_CONFIG.lightMappings)) {
                const regex = new RegExp(pattern, 'i');
                if (regex.test(nameLower)) {
                    return room;
                }
            }

            return null;
        }

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

                    // Create radiating light
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

                    document.getElementById('lamp-housing').appendChild(rays);
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

        async function toggleLight(lightId, currentState) {
            try {
                const newState = !currentState;

                // Send command to Hue Bridge
                const response = await fetch(`http://${BRIDGE_IP}/api/${USERNAME}/lights/${lightId}/state`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ on: newState })
                });

                if (response.ok) {
                    // Get light name for logging
                    try {
                        const lightsResponse = await fetch(`http://${BRIDGE_IP}/api/${USERNAME}/lights/${lightId}`);
                        if (lightsResponse.ok) {
                            const lightData = await lightsResponse.json();
                            const lightName = lightData.name || `Light ${lightId}`;
                            logLightEvent(lightName, newState);
                        }
                    } catch (e) {
                        // If we can't get the name, log with ID
                        logLightEvent(`Light ${lightId}`, newState);
                    }

                    // Refresh lights after a short delay
                    setTimeout(loadLights, 500);
                } else {
                    Logger.error('Failed to toggle light');
                }
            } catch (error) {
                Logger.error('Error toggling light:', error);
            }
        }

        async function loadLights() {
            try {
                const response = await fetch(`http://${BRIDGE_IP}/api/${USERNAME}/lights`);
                if (!response.ok) return;

                const lights = await response.json();

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
                            announceLight(room, currentState);
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

                // Update light indicators in UI
                updateLightIndicators();

                // Update outdoor lamppost if there are outdoor lights
                if (roomLights['Outdoor'].length > 0) {
                    const outdoorLightOn = roomLights['Outdoor'].some(light => light.on);
                    updateOutdoorLamppost(outdoorLightOn);
                } else {
                    // If no outdoor light detected, turn it off
                    updateOutdoorLamppost(false);
                }

            } catch (error) {
                Logger.error('Error loading lights:', error);
            }
        }

        function mapMotionSensorToRoom(sensorName) {
            const nameLower = sensorName.toLowerCase();

            // Check each mapping pattern from config
            for (const [pattern, room] of Object.entries(HOUSE_CONFIG.motionSensorMappings)) {
                const regex = new RegExp(pattern, 'i');
                if (regex.test(nameLower)) {
                    return room;
                }
            }

            return null;
        }

        async function buildThermostatPanel() {
            try {
                // Get Nest device data
                let currentTemp = null;
                let targetTemp = null;
                let status = 'OFF';
                let statusColor = '#999';
                let mode = 'Unknown';
                let deviceName = 'Nest Thermostat';
                let humidity = null;

                // Fetch fresh Nest data
                const devices = typeof fetchNestDevices === 'function' ? await fetchNestDevices() : null;

                if (devices && devices.length > 0) {
                    const device = devices[0];
                    const tempTrait = device.traits['sdm.devices.traits.Temperature'];
                    const thermostatTrait = device.traits['sdm.devices.traits.ThermostatTemperatureSetpoint'];
                    const humidityTrait = device.traits['sdm.devices.traits.Humidity'];
                    const infoTrait = device.traits['sdm.devices.traits.Info'];
                    const modeTrait = device.traits['sdm.devices.traits.ThermostatMode'];

                    if (tempTrait) {
                        currentTemp = tempTrait.ambientTemperatureCelsius.toFixed(1);
                    }

                    if (humidityTrait) {
                        humidity = humidityTrait.ambientHumidityPercent;
                    }

                    if (infoTrait?.customName) {
                        deviceName = infoTrait.customName;
                    }

                    if (modeTrait?.mode) {
                        mode = modeTrait.mode.toUpperCase();
                    }

                    if (thermostatTrait?.heatCelsius) {
                        targetTemp = thermostatTrait.heatCelsius.toFixed(1);
                        mode = 'HEAT';
                        // Check if actively heating
                        if (currentTemp && parseFloat(currentTemp) < thermostatTrait.heatCelsius - 0.5) {
                            status = 'HEATING';
                            statusColor = '#FF6B35';
                        } else {
                            status = 'IDLE';
                            statusColor = '#4CAF50';
                        }
                    } else if (thermostatTrait?.coolCelsius) {
                        targetTemp = thermostatTrait.coolCelsius.toFixed(1);
                        mode = 'COOL';
                        // Check if actively cooling
                        if (currentTemp && parseFloat(currentTemp) > thermostatTrait.coolCelsius + 0.5) {
                            status = 'COOLING';
                            statusColor = '#4ECDC4';
                        } else {
                            status = 'IDLE';
                            statusColor = '#4CAF50';
                        }
                    }

                    // IMPORTANT: Also update the visual display in the house with this data
                    if (currentTemp && typeof updateNestVisualDisplay === 'function') {
                        updateNestVisualDisplay(
                            parseFloat(currentTemp),
                            targetTemp ? parseFloat(targetTemp) : null,
                            status,
                            statusColor
                        );
                    }
                }

                const tempColor = currentTemp ? getTemperatureColor(parseFloat(currentTemp)) : '#999';

                let html = `<div style="background: linear-gradient(135deg, #FF6B6B 0%, #FF8E8E 100%); padding: 15px; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border: 2px solid #FF5252;">`;
                html += `<div style="font-weight: 700; font-size: 16px; margin-bottom: 12px; color: white; font-family: 'Fredoka', sans-serif;">🌡️ ${deviceName}</div>`;

                // Current Temperature
                if (currentTemp) {
                    html += `<div style="display: flex; align-items: center; margin-bottom: 8px; padding: 6px; background: rgba(255,255,255,0.9); border-radius: 8px;">`;
                    html += `<span style="font-size: 20px; margin-right: 8px;">🌡️</span>`;
                    html += `<span style="flex: 1; font-weight: 600;">Current Temp</span>`;
                    html += `<span style="font-weight: 700; color: ${tempColor}; font-size: 18px;">${currentTemp}°C</span>`;
                    html += `</div>`;
                }

                // Target Temperature
                if (targetTemp) {
                    html += `<div style="display: flex; align-items: center; margin-bottom: 8px; padding: 6px; background: rgba(255,255,255,0.9); border-radius: 8px;">`;
                    html += `<span style="font-size: 20px; margin-right: 8px;">🎯</span>`;
                    html += `<span style="flex: 1; font-weight: 600;">Target Temp</span>`;
                    html += `<span style="font-weight: 700; color: #FF6B35; font-size: 18px;">${targetTemp}°C</span>`;
                    html += `</div>`;
                }

                // Status
                html += `<div style="display: flex; align-items: center; margin-bottom: 8px; padding: 6px; background: rgba(255,255,255,0.9); border-radius: 8px;">`;
                html += `<span style="flex: 1; font-weight: 600;">Status</span>`;
                html += `<span style="font-weight: 700; color: ${statusColor};">${status}</span>`;
                html += `</div>`;

                // Mode
                html += `<div style="display: flex; align-items: center; margin-bottom: 8px; padding: 6px; background: rgba(255,255,255,0.9); border-radius: 8px;">`;
                html += `<span style="flex: 1; font-weight: 600;">Mode</span>`;
                html += `<span style="font-weight: 700; color: #666;">${mode}</span>`;
                html += `</div>`;

                // Humidity
                if (humidity !== null) {
                    const humidityColor = humidity > 60 ? '#4ECDC4' : humidity < 30 ? '#FF9800' : '#4CAF50';
                    html += `<div style="display: flex; align-items: center; margin-bottom: 8px; padding: 6px; background: rgba(255,255,255,0.9); border-radius: 8px;">`;
                    html += `<span style="font-size: 20px; margin-right: 8px;">💧</span>`;
                    html += `<span style="flex: 1; font-weight: 600;">Humidity</span>`;
                    html += `<span style="font-weight: 700; color: ${humidityColor};">${humidity}%</span>`;
                    html += `</div>`;
                }

                // Location
                html += `<div style="display: flex; align-items: center; padding: 6px; background: rgba(255,255,255,0.9); border-radius: 8px;">`;
                html += `<span style="flex: 1; font-weight: 600; font-size: 12px;">Location</span>`;
                html += `<span style="font-weight: 700; color: #666; font-size: 11px;">Main Bedroom</span>`;
                html += `</div>`;

                html += `</div>`;
                return html;
            } catch (error) {
                Logger.error('Error building thermostat panel:', error);
                return '';
            }
        }

        async function buildSpeakerPanel(name, ip) {
            try {
                // Query speaker status
                const volumeInfo = await getSonosVolume(ip);
                const transportInfo = await getSonosTransportInfo(ip);

                const isPlaying = transportInfo === 'PLAYING';
                const statusColor = isPlaying ? '#4CAF50' : '#999';
                const statusText = isPlaying ? '▶️ Playing' : '⏸️ Paused';

                let html = `<div style="background: linear-gradient(135deg, #2C3E50 0%, #34495E 100%); padding: 15px; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border: 2px solid #1A252F;">`;
                html += `<div style="font-weight: 700; font-size: 16px; margin-bottom: 12px; color: white; font-family: 'Fredoka', sans-serif;">🔊 Sonos ${name}</div>`;

                // Status
                html += `<div style="display: flex; align-items: center; margin-bottom: 8px; padding: 6px; background: rgba(255,255,255,0.9); border-radius: 8px;">`;
                html += `<span style="flex: 1; font-weight: 600;">Status</span>`;
                html += `<span style="font-weight: 700; color: ${statusColor};">${statusText}</span>`;
                html += `</div>`;

                // Volume
                if (volumeInfo !== null) {
                    const volumeColor = volumeInfo > 70 ? '#f44336' : volumeInfo > 40 ? '#FFA500' : '#4CAF50';
                    html += `<div style="display: flex; align-items: center; margin-bottom: 8px; padding: 6px; background: rgba(255,255,255,0.9); border-radius: 8px;">`;
                    html += `<span style="font-size: 20px; margin-right: 8px;">🔉</span>`;
                    html += `<span style="flex: 1; font-weight: 600;">Volume</span>`;
                    html += `<span style="font-weight: 700; color: ${volumeColor};">${volumeInfo}%</span>`;
                    html += `</div>`;
                }

                // IP Address
                html += `<div style="display: flex; align-items: center; padding: 6px; background: rgba(255,255,255,0.9); border-radius: 8px;">`;
                html += `<span style="flex: 1; font-weight: 600; font-size: 12px;">IP</span>`;
                html += `<span style="font-weight: 700; color: #666; font-size: 11px;">${ip}</span>`;
                html += `</div>`;

                html += `</div>`;
                return html;
            } catch (error) {
                Logger.error(`Error building speaker panel for ${name}:`, error);
                return '';
            }
        }

        async function buildHubPanel() {
            const HUB_IP = HOUSE_CONFIG.devices.googleHub;
            const HUB_NAME = 'Google Home Hub';

            try {
                // Get Hub status
                const statusResponse = await fetch(`http://${HUB_IP}:8008/apps`);
                const statusText = await statusResponse.text();

                let isPlaying = false;
                let appName = 'Idle';

                try {
                    const statusData = JSON.parse(statusText);
                    if (statusData.applications && statusData.applications.length > 0) {
                        isPlaying = true;
                        appName = statusData.applications[0].displayName || 'Active';
                    }
                } catch (e) {
                    // Idle state
                }

                const statusColor = isPlaying ? '#4CAF50' : '#999';
                const statusIcon = isPlaying ? '▶️' : '💤';

                let html = `<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border: 2px solid #5568d3;">`;
                html += `<div style="font-weight: 700; font-size: 16px; margin-bottom: 12px; color: white; font-family: 'Fredoka', sans-serif;">📺 ${HUB_NAME}</div>`;

                // Status
                html += `<div style="display: flex; align-items: center; margin-bottom: 8px; padding: 6px; background: rgba(255,255,255,0.9); border-radius: 8px;">`;
                html += `<span style="flex: 1; font-weight: 600;">Status</span>`;
                html += `<span style="font-weight: 700; color: ${statusColor};">${statusIcon} ${appName}</span>`;
                html += `</div>`;

                // Quick Actions
                html += `<div style="margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">`;

                // Announce button
                html += `<button onclick="hubAnnounce()" style="padding: 8px; background: #4CAF50; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 12px;">📢 Announce</button>`;

                // Stop button
                html += `<button onclick="hubStop()" style="padding: 8px; background: #f44336; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 12px;">⏹️ Stop</button>`;

                // YouTube button
                html += `<button onclick="hubYouTube()" style="padding: 8px; background: #FF0000; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 12px;">▶️ YouTube</button>`;

                // Dashboard button
                html += `<button onclick="hubShowDashboard()" style="padding: 8px; background: #2196F3; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 12px;">🏠 Dashboard</button>`;

                html += `</div>`;

                // IP Address
                html += `<div style="display: flex; align-items: center; margin-top: 8px; padding: 6px; background: rgba(255,255,255,0.9); border-radius: 8px;">`;
                html += `<span style="flex: 1; font-weight: 600; font-size: 12px;">IP</span>`;
                html += `<span style="font-weight: 700; color: #666; font-size: 11px;">${HUB_IP}</span>`;
                html += `</div>`;

                html += `</div>`;
                return html;
            } catch (error) {
                Logger.error('Error building Hub panel:', error);
                return '';
            }
        }

        async function getSonosVolume(ip) {
            try {
                const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:GetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1">
      <InstanceID>0</InstanceID>
      <Channel>Master</Channel>
    </u:GetVolume>
  </s:Body>
</s:Envelope>`;

                const response = await fetch(`${APP_CONFIG.proxies.sonos}/MediaRenderer/RenderingControl/Control`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/xml; charset="utf-8"',
                        'SOAPAction': '"urn:schemas-upnp-org:service:RenderingControl:1#GetVolume"',
                        'X-Sonos-IP': ip
                    },
                    body: soapBody
                });

                if (!response.ok) return null;

                const text = await response.text();
                const match = text.match(/<CurrentVolume>(\d+)<\/CurrentVolume>/);
                return match ? parseInt(match[1]) : null;
            } catch (error) {
                return null;
            }
        }

        async function getSonosTransportInfo(ip) {
            try {
                const soapBody = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:GetTransportInfo xmlns:u="urn:schemas-upnp-org:service:AVTransport:1">
      <InstanceID>0</InstanceID>
    </u:GetTransportInfo>
  </s:Body>
</s:Envelope>`;

                const response = await fetch(`${APP_CONFIG.proxies.sonos}/MediaRenderer/AVTransport/Control`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/xml; charset="utf-8"',
                        'SOAPAction': '"urn:schemas-upnp-org:service:AVTransport:1#GetTransportInfo"',
                        'X-Sonos-IP': ip
                    },
                    body: soapBody
                });

                if (!response.ok) return 'STOPPED';

                const text = await response.text();
                const match = text.match(/<CurrentTransportState>(.*?)<\/CurrentTransportState>/);
                return match ? match[1] : 'STOPPED';
            } catch (error) {
                return 'STOPPED';
            }
        }

        async function loadSensorDetails() {
            try {
                const response = await fetch(`http://${BRIDGE_IP}/api/${USERNAME}/sensors`);
                if (!response.ok) return;

                const sensors = await response.json();
                const container = document.getElementById('sensor-details');
                if (!container) return;

                // Start building HTML with custom panels for thermostat and speakers
                let html = '';

                // Add Thermostat Panel
                html += await buildThermostatPanel();

                // Add Speaker Panels
                html += await buildSpeakerPanel('Bedroom', '192.168.68.61');
                html += await buildSpeakerPanel('Office', '192.168.68.75');
                html += await buildSpeakerPanel('Lounge', '192.168.68.64');

                // Add Google Home Hub Panel
                html += await buildHubPanel();

                // Group sensors by their physical device (based on uniqueid prefix)
                const sensorGroups = {};

                for (const [sensorId, sensorInfo] of Object.entries(sensors)) {
                    // Extract base name (remove "motion sensor", "temperature", etc.)
                    let baseName = sensorInfo.name
                        .replace(/temperature sensor/i, '')
                        .replace(/motion sensor/i, '')
                        .replace(/ambient light sensor/i, '')
                        .replace(/\d+$/i, '') // Remove trailing numbers
                        .trim();

                    if (!baseName) baseName = sensorInfo.name;

                    if (!sensorGroups[baseName]) {
                        sensorGroups[baseName] = {
                            name: baseName,
                            temperature: null,
                            lightLevel: null,
                            motion: null,
                            battery: null
                        };
                    }

                    // Collect data based on sensor type
                    if (sensorInfo.type === 'ZLLTemperature' && sensorInfo.state.temperature !== null) {
                        sensorGroups[baseName].temperature = (sensorInfo.state.temperature / 100).toFixed(1);
                    }
                    if (sensorInfo.type === 'ZLLLightLevel' && sensorInfo.state.lightlevel !== null) {
                        sensorGroups[baseName].lightLevel = sensorInfo.state.lightlevel;
                        sensorGroups[baseName].lux = sensorInfo.state.daylight ? 'Daylight' : sensorInfo.state.dark ? 'Dark' : 'Dim';
                    }
                    if (sensorInfo.type === 'ZLLPresence') {
                        sensorGroups[baseName].motion = sensorInfo.state.presence;
                    }
                    if (sensorInfo.config && sensorInfo.config.battery !== undefined) {
                        sensorGroups[baseName].battery = sensorInfo.config.battery;
                    }
                }

                // Build HTML for sensor cards (append to existing html with thermostat and speakers)
                for (const [key, sensor] of Object.entries(sensorGroups)) {
                    // Only show sensors that have at least one data point
                    if (!sensor.temperature && sensor.lightLevel === null && sensor.motion === null && sensor.battery === null) {
                        continue;
                    }

                    const roomEmoji = {
                        'Landing': '🪜',
                        'Main Bedroom': '🛏️',
                        'Guest Room': '🛏️',
                        'Hue temperature sensor': '🏢',
                        'Bathroom': '🚿',
                        'Hall': '🚪',
                        'Lounge': '🛋️',
                        'ExtensionDimmer': '🏠',
                        'KitchenSensor': '🍳',
                        'Hue outdoor temp. sensor': '🌳'
                    };
                    const emoji = roomEmoji[sensor.name] || '📍';

                    // Battery color based on level
                    let batteryColor = '#4CAF50'; // Green
                    if (sensor.battery !== null) {
                        if (sensor.battery < 20) batteryColor = '#f44336'; // Red
                        else if (sensor.battery < 50) batteryColor = '#FF9800'; // Orange
                    }

                    // Light level emoji
                    let lightEmoji = '☀️';
                    if (sensor.lux === 'Dark') lightEmoji = '🌙';
                    else if (sensor.lux === 'Dim') lightEmoji = '🌤️';

                    html += `<div style="background: linear-gradient(135deg, #ffffff 0%, #f5f5f5 100%); padding: 15px; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border: 2px solid #e0e0e0;">`;
                    html += `<div style="font-weight: 700; font-size: 16px; margin-bottom: 12px; color: #333; font-family: 'Fredoka', sans-serif;">${emoji} ${sensor.name}</div>`;

                    // Temperature
                    if (sensor.temperature) {
                        const tempColor = getTemperatureColor(parseFloat(sensor.temperature));
                        html += `<div style="display: flex; align-items: center; margin-bottom: 8px; padding: 6px; background: white; border-radius: 8px;">`;
                        html += `<span style="font-size: 20px; margin-right: 8px;">🌡️</span>`;
                        html += `<span style="flex: 1; font-weight: 600;">Temperature</span>`;
                        html += `<span style="font-weight: 700; color: ${tempColor}; font-size: 18px;">${sensor.temperature}°C</span>`;
                        html += `</div>`;
                    }

                    // Light Level
                    if (sensor.lightLevel !== null) {
                        html += `<div style="display: flex; align-items: center; margin-bottom: 8px; padding: 6px; background: white; border-radius: 8px;">`;
                        html += `<span style="font-size: 20px; margin-right: 8px;">${lightEmoji}</span>`;
                        html += `<span style="flex: 1; font-weight: 600;">Light Level</span>`;
                        html += `<span style="font-weight: 700; color: #FFA500;">${sensor.lux} (${sensor.lightLevel})</span>`;
                        html += `</div>`;
                    }

                    // Motion
                    if (sensor.motion !== null) {
                        const motionColor = sensor.motion ? '#f44336' : '#4CAF50';
                        const motionText = sensor.motion ? '🚶 DETECTED' : '✅ Clear';
                        html += `<div style="display: flex; align-items: center; margin-bottom: 8px; padding: 6px; background: white; border-radius: 8px;">`;
                        html += `<span style="flex: 1; font-weight: 600;">Motion</span>`;
                        html += `<span style="font-weight: 700; color: ${motionColor};">${motionText}</span>`;
                        html += `</div>`;
                    }

                    // Battery
                    if (sensor.battery !== null) {
                        let batteryIcon = '🔋';
                        if (sensor.battery < 20) batteryIcon = '🪫';
                        html += `<div style="display: flex; align-items: center; padding: 6px; background: white; border-radius: 8px;">`;
                        html += `<span style="font-size: 20px; margin-right: 8px;">${batteryIcon}</span>`;
                        html += `<span style="flex: 1; font-weight: 600;">Battery</span>`;
                        html += `<span style="font-weight: 700; color: ${batteryColor};">${sensor.battery}%</span>`;
                        html += `</div>`;
                    }

                    html += `</div>`;
                }

                container.innerHTML = html || '<div style="text-align: center; color: #999; padding: 20px;">No sensor data available</div>';

            } catch (error) {
                Logger.error('Error loading sensor details:', error);
            }
        }

        async function loadMotionSensors() {
            try {
                const response = await fetch(`http://${BRIDGE_IP}/api/${USERNAME}/sensors`);
                if (!response.ok) return;

                const sensors = await response.json();

                // Process motion sensors
                for (const [sensorId, sensorInfo] of Object.entries(sensors)) {
                    if (sensorInfo.type === 'ZLLPresence') {
                        const room = mapMotionSensorToRoom(sensorInfo.name);

                        if (room && motionSensors[room]) {
                            // Store previous state
                            motionSensors[room].previousDetected = motionSensors[room].detected;

                            // Update current state
                            motionSensors[room].detected = sensorInfo.state.presence;
                            motionSensors[room].lastUpdated = sensorInfo.state.lastupdated;

                            // Check if motion just started (changed from false to true)
                            if (motionSensors[room].detected && !motionSensors[room].previousDetected) {
                                announceMotion(room);
                                logMotionEvent(room); // Log the event
                            }
                        }
                    }
                }

                // Update motion indicators in UI
                updateMotionIndicators();

            } catch (error) {
                Logger.error('Error loading motion sensors:', error);
            }
        }

        function updateMotionIndicators() {
            const positions = {
                'Outdoor': { x: 155, y: 100, isOutdoor: true },
                'Hall': { x: 200, y: 420 },
                'Landing': { x: 340, y: 250 },
                'Bathroom': { x: 660, y: 250 }
            };

            const container = document.getElementById('motion-indicators-container');
            if (!container) return;

            // Clear both indoor and outdoor motion indicators
            container.innerHTML = '';

            // Clear outdoor motion indicators (they're in the outdoor-area container)
            const outdoorArea = document.querySelector('#outdoor-area');
            if (outdoorArea) {
                // Remove any existing motion indicator groups from outdoor area
                const outdoorMotionIndicators = outdoorArea.querySelectorAll('.motion-indicator');
                outdoorMotionIndicators.forEach(el => el.remove());
            }

            const ns = 'http://www.w3.org/2000/svg';

            for (const [room, motion] of Object.entries(motionSensors)) {
                if (!motion.detected) continue; // Only show when motion detected

                const pos = positions[room];
                if (!pos) continue;

                // Create motion indicator group
                const group = document.createElementNS(ns, 'g');
                group.setAttribute('class', 'motion-indicator'); // Add class for easy cleanup

                if (pos.isOutdoor) {
                    // Position relative to outdoor area
                    group.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
                } else {
                    group.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
                }

                // Monkey face icon
                const monkeyGroup = document.createElementNS(ns, 'g');
                monkeyGroup.setAttribute('class', 'monkey-shake');

                // Monkey head (brown circle)
                const head = document.createElementNS(ns, 'circle');
                head.setAttribute('cx', '0');
                head.setAttribute('cy', '0');
                head.setAttribute('r', '18');
                head.setAttribute('fill', '#8B4513');
                head.setAttribute('stroke', '#5D2E0F');
                head.setAttribute('stroke-width', '2');
                monkeyGroup.appendChild(head);

                // Face area (lighter brown)
                const face = document.createElementNS(ns, 'ellipse');
                face.setAttribute('cx', '0');
                face.setAttribute('cy', '3');
                face.setAttribute('rx', '12');
                face.setAttribute('ry', '10');
                face.setAttribute('fill', '#D2691E');
                monkeyGroup.appendChild(face);

                // Left ear
                const leftEar = document.createElementNS(ns, 'circle');
                leftEar.setAttribute('cx', '-15');
                leftEar.setAttribute('cy', '-8');
                leftEar.setAttribute('r', '6');
                leftEar.setAttribute('fill', '#8B4513');
                leftEar.setAttribute('stroke', '#5D2E0F');
                leftEar.setAttribute('stroke-width', '1.5');
                monkeyGroup.appendChild(leftEar);

                // Right ear
                const rightEar = document.createElementNS(ns, 'circle');
                rightEar.setAttribute('cx', '15');
                rightEar.setAttribute('cy', '-8');
                rightEar.setAttribute('r', '6');
                rightEar.setAttribute('fill', '#8B4513');
                rightEar.setAttribute('stroke', '#5D2E0F');
                rightEar.setAttribute('stroke-width', '1.5');
                monkeyGroup.appendChild(rightEar);

                // Left eye
                const leftEye = document.createElementNS(ns, 'circle');
                leftEye.setAttribute('cx', '-6');
                leftEye.setAttribute('cy', '-2');
                leftEye.setAttribute('r', '3');
                leftEye.setAttribute('fill', 'white');
                monkeyGroup.appendChild(leftEye);

                const leftPupil = document.createElementNS(ns, 'circle');
                leftPupil.setAttribute('cx', '-5');
                leftPupil.setAttribute('cy', '-1');
                leftPupil.setAttribute('r', '2');
                leftPupil.setAttribute('fill', 'black');
                monkeyGroup.appendChild(leftPupil);

                // Right eye
                const rightEye = document.createElementNS(ns, 'circle');
                rightEye.setAttribute('cx', '6');
                rightEye.setAttribute('cy', '-2');
                rightEye.setAttribute('r', '3');
                rightEye.setAttribute('fill', 'white');
                monkeyGroup.appendChild(rightEye);

                const rightPupil = document.createElementNS(ns, 'circle');
                rightPupil.setAttribute('cx', '7');
                rightPupil.setAttribute('cy', '-1');
                rightPupil.setAttribute('r', '2');
                rightPupil.setAttribute('fill', 'black');
                monkeyGroup.appendChild(rightPupil);

                // Nose
                const nose = document.createElementNS(ns, 'ellipse');
                nose.setAttribute('cx', '0');
                nose.setAttribute('cy', '5');
                nose.setAttribute('rx', '3');
                nose.setAttribute('ry', '2');
                nose.setAttribute('fill', '#5D2E0F');
                monkeyGroup.appendChild(nose);

                // Mouth (smile)
                const mouth = document.createElementNS(ns, 'path');
                mouth.setAttribute('d', 'M -5 8 Q 0 12 5 8');
                mouth.setAttribute('stroke', '#5D2E0F');
                mouth.setAttribute('stroke-width', '1.5');
                mouth.setAttribute('fill', 'none');
                mouth.setAttribute('stroke-linecap', 'round');
                monkeyGroup.appendChild(mouth);

                group.appendChild(monkeyGroup);

                // Schedule fade-out after 30 seconds
                setTimeout(() => {
                    monkeyGroup.setAttribute('class', 'monkey-shake monkey-fadeout');
                    // Remove the element after fade completes
                    setTimeout(() => {
                        group.remove();
                    }, 2000);
                }, 30000);

                // Pulsing circle around person
                const pulseCircle = document.createElementNS(ns, 'circle');
                pulseCircle.setAttribute('cx', '0');
                pulseCircle.setAttribute('cy', '0');
                pulseCircle.setAttribute('r', '15');
                pulseCircle.setAttribute('fill', 'none');
                pulseCircle.setAttribute('stroke', '#FF6B6B');
                pulseCircle.setAttribute('stroke-width', '2');
                pulseCircle.setAttribute('opacity', '0.6');
                pulseCircle.setAttribute('class', 'motion-pulse');
                group.appendChild(pulseCircle);

                // Motion text label
                const label = document.createElementNS(ns, 'text');
                label.setAttribute('x', '0');
                label.setAttribute('y', '35');
                label.setAttribute('text-anchor', 'middle');
                label.setAttribute('font-size', '12');
                label.setAttribute('font-weight', '700');
                label.setAttribute('font-family', 'Fredoka');
                label.setAttribute('fill', '#5D2E0F');
                label.textContent = 'OOH OOH!';
                group.appendChild(label);

                if (pos.isOutdoor) {
                    document.querySelector('#outdoor-area').appendChild(group);
                } else {
                    container.appendChild(group);
                }
            }
        }

        function updateLightIndicators() {
            const roomPositionsForLights = {
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

                const pos = roomPositionsForLights[room];
                if (!pos) continue;

                // Create a group for this room's lights
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
                        toggleLight(light.id, light.on);
                    });

                    group.appendChild(bulb);
                });

                container.appendChild(group);
            }
        }

        async function loadTemperatures(showSparkles = true) {
            const btn = document.getElementById('refreshBtn');
            if (showSparkles && btn) btn.classList.add('loading');

            try {
                const response = await fetch(`http://${BRIDGE_IP}/api/${USERNAME}/sensors`);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const sensors = await response.json();
                const temps = [];

                // Clear existing thermometers
                document.getElementById('thermometers-container').innerHTML = '';
                document.getElementById('outdoor-thermometer-container').innerHTML = '';

                for (const [sensorId, sensorInfo] of Object.entries(sensors)) {
                    if (sensorInfo.type === 'ZLLTemperature') {
                        const name = sensorInfo.name;
                        const elementId = sensorMapping[name];

                        if (elementId) {
                            const temp = sensorInfo.state.temperature;

                            if (temp !== null && temp !== undefined) {
                                const tempC = (temp / 100.0).toFixed(1);
                                const roomName = roomNames[name] || name;

                                // Create thermometer for this room
                                const tempElement = createThermometer(elementId, parseFloat(tempC), roomName);

                                // Save temperature data for graphing
                                saveTempData(name, tempC);

                                // Create sparkles on update!
                                if (tempElement && showSparkles) {
                                    setTimeout(() => createSparkles(tempElement), 100);
                                }

                                // Only add to stats if not outdoor
                                if (name !== 'Hue outdoor temp. sensor 1') {
                                    temps.push(parseFloat(tempC));
                                }
                            }
                            // If temp is null/undefined, we simply don't create a thermometer (nothing displayed)
                        }
                    }
                }

                // Calculate statistics
                if (temps.length > 0) {
                    const avg = (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1);
                    const max = Math.max(...temps).toFixed(1);
                    const min = Math.min(...temps).toFixed(1);
                    const range = (max - min).toFixed(1);

                    const avgEl = document.getElementById('avg-temp');
                    const maxEl = document.getElementById('max-temp');
                    const minEl = document.getElementById('min-temp');
                    const rangeEl = document.getElementById('range-temp');

                    // Only update if elements exist (they were removed from UI)
                    if (avgEl) avgEl.textContent = avg + '°C';
                    if (maxEl) maxEl.textContent = max + '°C';
                    if (minEl) minEl.textContent = min + '°C';
                    if (rangeEl) rangeEl.textContent = range + '°C';

                    // Add sparkles to stats cards
                    if (showSparkles) {
                        if (avgEl) setTimeout(() => createSparkles(avgEl), 100);
                        if (maxEl) setTimeout(() => createSparkles(maxEl), 200);
                        if (minEl) setTimeout(() => createSparkles(minEl), 300);
                        if (rangeEl) setTimeout(() => createSparkles(rangeEl), 400);
                    }
                }

                const now = new Date();
                const lastUpdateEl = document.getElementById('lastUpdate');
                if (lastUpdateEl) {
                    lastUpdateEl.textContent = `Last updated: ${now.toLocaleString()} ✨`;
                }

                // Redraw graph with new data (only if graph exists)
                if (typeof drawGraph === 'function') {
                    drawGraph();
                }

            } catch (error) {
                Logger.error('Error loading temperatures:', error);
                const lastUpdateEl = document.getElementById('lastUpdate');
                if (lastUpdateEl) {
                    lastUpdateEl.textContent = `⚠️ Oops! ${error.message}`;
                }
            } finally {
                if (showSparkles && btn) btn.classList.remove('loading');
            }
        }

        // Diagnostic: Show all lights
        async function showAllLights() {
            try {
                const response = await fetch(`http://${BRIDGE_IP}/api/${USERNAME}/lights`);
                const lights = await response.json();

                Logger.info('\n');
                Logger.info('═══════════════════════════════════════════════════════════');
                Logger.info('                    ALL HUE LIGHTS                         ');
                Logger.info('═══════════════════════════════════════════════════════════');
                Logger.info('\n');

                for (const [id, light] of Object.entries(lights)) {
                    const room = mapLightToRoom(light.name);
                    Logger.info(`┌─ Light ID: ${id} ─────────────────────────────────────`);
                    Logger.info(`│ Name: "${light.name}"`);
                    Logger.info(`│ Type: ${light.type}`);
                    Logger.info(`│ Model: ${light.modelid || 'N/A'}`);
                    Logger.info(`│ State: ${light.state.on ? 'ON' : 'OFF'}`);
                    Logger.info(`│ Reachable: ${light.state.reachable}`);
                    Logger.info(`│ Mapped to room: ${room || '❌ NOT MAPPED'}`);
                    Logger.info('└────────────────────────────────────────────────────────');
                    Logger.info('\n');
                }

                Logger.info('═══════════════════════════════════════════════════════════');
                Logger.info(`Total lights found: ${Object.keys(lights).length}`);
                Logger.info('═══════════════════════════════════════════════════════════');
                Logger.info('\n');

            } catch (error) {
                Logger.error('Error fetching lights:', error);
            }
        }

        // Diagnostic: Show all sensors
        async function showAllSensors() {
            try {
                const response = await fetch(`http://${BRIDGE_IP}/api/${USERNAME}/sensors`);
                const sensors = await response.json();

                Logger.info('\n');
                Logger.info('═══════════════════════════════════════════════════════════');
                Logger.info('                    ALL HUE SENSORS                        ');
                Logger.info('═══════════════════════════════════════════════════════════');
                Logger.info('\n');

                for (const [id, sensor] of Object.entries(sensors)) {
                    Logger.info(`┌─ Sensor ID: ${id} ─────────────────────────────────────`);
                    Logger.info(`│ Name: "${sensor.name}"`);
                    Logger.info(`│ Type: ${sensor.type}`);
                    Logger.info(`│ Model: ${sensor.modelid || 'N/A'}`);
                    Logger.info(`│ Manufacturer: ${sensor.manufacturername || 'N/A'}`);

                    if (sensor.state) {
                        Logger.info(`│ State:`);
                        for (const [key, value] of Object.entries(sensor.state)) {
                            Logger.info(`│   - ${key}: ${value}`);
                        }
                    }

                    Logger.info('└────────────────────────────────────────────────────────');
                    Logger.info('\n');
                }

                Logger.info('═══════════════════════════════════════════════════════════');
                Logger.info(`Total sensors found: ${Object.keys(sensors).length}`);
                Logger.info('═══════════════════════════════════════════════════════════');
                Logger.info('\n');

            } catch (error) {
                Logger.error('Error fetching sensors:', error);
            }
        }

        // Initialize temperature history
        initTempHistory();

        // Initialize motion detection history
        initMotionHistory();

        // Toggle collapsible sections
        function toggleSection(contentId, arrowId) {
            const content = document.getElementById(contentId);
            const arrow = document.getElementById(arrowId);

            if (content && arrow) {
                content.classList.toggle('collapsed');
                arrow.classList.toggle('collapsed');
            }
        }

        // Chelmsford, Essex, UK coordinates
        const CHELMSFORD_LAT = 51.7356;
        const CHELMSFORD_LNG = 0.4685;

        // Store sunrise/sunset times
        let sunriseTime = null;
        let sunsetTime = null;

        // Fetch sunrise/sunset times for Chelmsford
        async function fetchSunTimes() {
            try {
                const response = await fetch(`https://api.sunrise-sunset.org/json?lat=${CHELMSFORD_LAT}&lng=${CHELMSFORD_LNG}&formatted=0`);
                const data = await response.json();

                if (data.status === 'OK') {
                    sunriseTime = new Date(data.results.sunrise);
                    sunsetTime = new Date(data.results.sunset);

                    Logger.info(`🌅 Sunrise today: ${sunriseTime.toLocaleTimeString()}`);
                    Logger.info(`🌇 Sunset today: ${sunsetTime.toLocaleTimeString()}`);

                    // Update sky immediately with new times
                    updateSky();
                }
            } catch (error) {
                Logger.error('Error fetching sun times:', error);
                // Fallback to default times if API fails
                const now = new Date();
                sunriseTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0);
                sunsetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0);
            }
        }

        // Fetch weather data from WeatherAPI.com
        async function fetchWeather() {
            if (!WEATHER_CONFIG?.API_KEY || WEATHER_CONFIG.API_KEY === 'YOUR-WEATHERAPI-KEY-HERE') {
                Logger.warn('⚠️ Weather API key not configured');
                return null;
            }

            try {
                const response = await fetch(
                    `https://api.weatherapi.com/v1/current.json?key=${WEATHER_CONFIG.API_KEY}&q=${WEATHER_CONFIG.LOCATION}`
                );

                if (!response.ok) {
                    throw new Error(`Weather API error: ${response.status}`);
                }

                const data = await response.json();

                return {
                    temp: data.current.temp_c,
                    condition: data.current.condition.text,
                    icon: data.current.condition.icon,
                    humidity: data.current.humidity,
                    feelsLike: data.current.feelslike_c,
                    uv: data.current.uv,
                    wind: data.current.wind_kph,
                    windDir: data.current.wind_dir
                };
            } catch (error) {
                Logger.error('Error fetching weather:', error);
                return null;
            }
        }

        // Update weather display
        async function updateWeatherDisplay() {
            const weatherData = await fetchWeather();

            if (!weatherData) {
                return;
            }

            // Update weather stat card (if it exists)
            const weatherTempEl = document.getElementById('weather-temp');
            const weatherConditionEl = document.getElementById('weather-condition');
            const weatherIconEl = document.getElementById('weather-icon');
            const weatherFeelsEl = document.getElementById('weather-feels');
            const weatherHumidityEl = document.getElementById('weather-humidity');
            const weatherUvEl = document.getElementById('weather-uv');

            if (weatherTempEl) weatherTempEl.textContent = `${weatherData.temp.toFixed(1)}°C`;
            if (weatherConditionEl) weatherConditionEl.textContent = weatherData.condition;
            if (weatherIconEl) weatherIconEl.src = `https:${weatherData.icon}`;
            if (weatherFeelsEl) weatherFeelsEl.textContent = `Feels like ${weatherData.feelsLike.toFixed(1)}°C`;
            if (weatherHumidityEl) weatherHumidityEl.textContent = `💧 ${weatherData.humidity}%`;
            if (weatherUvEl) weatherUvEl.textContent = `☀️ UV ${weatherData.uv}`;

            // Update SVG weather panel in sky
            const weatherTempSvgEl = document.getElementById('weather-temp-svg');
            const weatherConditionSvgEl = document.getElementById('weather-condition-svg');
            const weatherIconSvgEl = document.getElementById('weather-icon-svg');
            const weatherFeelsSvgEl = document.getElementById('weather-feels-svg');
            const weatherHumiditySvgEl = document.getElementById('weather-humidity-svg');
            const weatherUvSvgEl = document.getElementById('weather-uv-svg');
            const weatherWindSvgEl = document.getElementById('weather-wind-svg');
            const weatherWindDirSvgEl = document.getElementById('weather-wind-dir-svg');

            if (weatherTempSvgEl) weatherTempSvgEl.textContent = `${Math.round(weatherData.temp)}°`;
            if (weatherConditionSvgEl) weatherConditionSvgEl.textContent = weatherData.condition;
            if (weatherIconSvgEl) weatherIconSvgEl.setAttribute('href', `https:${weatherData.icon}`);
            if (weatherFeelsSvgEl) weatherFeelsSvgEl.textContent = `Feels: ${Math.round(weatherData.feelsLike)}°`;
            if (weatherHumiditySvgEl) weatherHumiditySvgEl.textContent = `💧 ${weatherData.humidity}%`;
            if (weatherUvSvgEl) weatherUvSvgEl.textContent = `☀️ UV ${weatherData.uv}`;
            if (weatherWindSvgEl) weatherWindSvgEl.textContent = `🌬️ ${Math.round(weatherData.wind)} km/h`;
            if (weatherWindDirSvgEl) weatherWindDirSvgEl.textContent = weatherData.windDir;

            Logger.info(`🌤️ Weather updated: ${weatherData.temp.toFixed(1)}°C, ${weatherData.condition}`);

            // Update visual effects based on weather
            updateWeatherVisuals(weatherData);
        }

        // Update visual effects based on weather conditions
        function updateWeatherVisuals(weatherData) {
            if (!weatherData) return;

            const rainEl = document.getElementById('rain');
            const snowEl = document.getElementById('snow');
            const fogEl = document.getElementById('fog');
            const skyGradient = document.getElementById('skyGradient');

            // Hide all weather effects by default
            if (rainEl) rainEl.style.display = 'none';
            if (snowEl) snowEl.style.display = 'none';
            if (fogEl) fogEl.style.display = 'none';

            const condition = weatherData.condition.toLowerCase();
            const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

            // Determine weather effects and sky colors
            let skyColor1, skyColor2;

            if (condition.includes('rain') || condition.includes('drizzle') || condition.includes('shower')) {
                // Show rain
                if (rainEl) rainEl.style.display = 'block';
                skyColor1 = '#6B7F8F';
                skyColor2 = '#8B9DAF';
                Logger.info('🌧️ Rain effect activated');
            } else if (condition.includes('snow') || condition.includes('sleet') || condition.includes('blizzard')) {
                // Show snow
                if (snowEl) snowEl.style.display = 'block';
                skyColor1 = '#D0D8E0';
                skyColor2 = '#E8EEF5';
                Logger.info('❄️ Snow effect activated');
            } else if (condition.includes('fog') || condition.includes('mist') || condition.includes('haze')) {
                // Show fog
                if (fogEl) fogEl.style.display = 'block';
                skyColor1 = '#B0B8C0';
                skyColor2 = '#D0D8E0';
                Logger.info('🌫️ Fog effect activated');
            } else if (condition.includes('thunder') || condition.includes('storm')) {
                // Stormy - darker sky, show rain
                if (rainEl) rainEl.style.display = 'block';
                skyColor1 = '#4A5568';
                skyColor2 = '#6B7F8F';
                Logger.info('⛈️ Storm effect activated');
            } else if (condition.includes('cloud') || condition.includes('overcast')) {
                // Cloudy
                skyColor1 = '#A0AEC0';
                skyColor2 = '#C0CED8';
                Logger.info('☁️ Cloudy sky');
            } else if (condition.includes('clear') || condition.includes('sunny')) {
                // Clear/Sunny - use default bright colors
                skyColor1 = '#87CEEB';
                skyColor2 = '#E0F6FF';
                Logger.info('☀️ Clear sky');
            } else {
                // Partly cloudy or other
                skyColor1 = '#98C8E8';
                skyColor2 = '#D0E8F8';
            }

            // Don't override sky colors in dark mode
            if (!isDarkMode && skyGradient) {
                const stops = skyGradient.getElementsByTagName('stop');
                if (stops.length >= 2) {
                    stops[0].setAttribute('style', `stop-color:${skyColor1};stop-opacity:0.3`);
                    stops[1].setAttribute('style', `stop-color:${skyColor2};stop-opacity:0.1`);
                }
            }

            // Adjust cloud opacity based on weather
            const cloudOpacity = condition.includes('cloud') || condition.includes('overcast') ? 0.9 : 0.7;
            const cloudColor = condition.includes('rain') || condition.includes('storm') ? '#808080' :
                              (condition.includes('fog') || condition.includes('mist') ? '#B0B0B0' : 'white');

            // Update CSS variable for clouds if not in dark mode
            if (!isDarkMode) {
                document.documentElement.style.setProperty('--cloud-color', cloudColor);
                document.documentElement.style.setProperty('--cloud-opacity', cloudOpacity);
            }
        }

        // Update sky based on time of day (using actual sunrise/sunset)
        function updateSky() {
            const now = new Date();

            const skyGradient = document.getElementById('skyGradient');
            const sun = document.getElementById('sun');
            const moon = document.getElementById('moon');
            const stars = document.getElementById('stars');

            if (!skyGradient) return;

            // Check for dark mode - override time-based sky if dark mode is active
            const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;

            if (isDarkMode) {
                // Force night theme in dark mode
                const skyConfig = {
                    color1: '#0B1026', // Dark blue/black
                    color2: '#1E3A5F', // Deep blue
                    showSun: false,
                    showMoon: true,
                    showStars: true
                };

                // Update sky gradient
                const stops = skyGradient.getElementsByTagName('stop');
                if (stops.length >= 2) {
                    stops[0].setAttribute('style', `stop-color:${skyConfig.color1};stop-opacity:1`);
                    stops[1].setAttribute('style', `stop-color:${skyConfig.color2};stop-opacity:1`);
                }

                // Show/hide sun, moon, and stars
                if (sun) sun.style.display = 'none';
                if (moon) moon.style.display = 'block';
                if (stars) stars.style.display = 'block';
                return;
            }

            // If we don't have sun times yet, use defaults
            if (!sunriseTime || !sunsetTime) {
                sunriseTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0);
                sunsetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0);
            }

            // Calculate time periods based on actual sunrise/sunset
            const dawnStart = new Date(sunriseTime.getTime() - 60 * 60 * 1000); // 1 hour before sunrise
            const dawnEnd = sunriseTime;
            const duskStart = sunsetTime;
            const duskEnd = new Date(sunsetTime.getTime() + 90 * 60 * 1000); // 1.5 hours after sunset

            let skyConfig;

            // Determine sky configuration based on actual sun times
            if (now >= dawnStart && now < dawnEnd) {
                // Dawn (1 hour before sunrise)
                skyConfig = {
                    color1: '#FF6B6B', // Pink
                    color2: '#FFD93D', // Golden yellow
                    showSun: true,
                    showMoon: false,
                    showStars: false
                };
            } else if (now >= dawnEnd && now < duskStart) {
                // Day (sunrise to sunset)
                skyConfig = {
                    color1: '#87CEEB', // Sky blue
                    color2: '#E0F6FF', // Very light blue
                    showSun: true,
                    showMoon: false,
                    showStars: false
                };
            } else if (now >= duskStart && now < duskEnd) {
                // Dusk (sunset to 1.5 hours after)
                skyConfig = {
                    color1: '#FF6B35', // Orange
                    color2: '#6A4C93', // Purple
                    showSun: true,
                    showMoon: false,
                    showStars: true
                };
            } else {
                // Night (rest of the time)
                skyConfig = {
                    color1: '#0B1026', // Dark blue/black
                    color2: '#1E3A5F', // Deep blue
                    showSun: false,
                    showMoon: true,
                    showStars: true
                };
            }

            // Update sky gradient
            const stops = skyGradient.getElementsByTagName('stop');
            if (stops.length >= 2) {
                stops[0].setAttribute('style', `stop-color:${skyConfig.color1};stop-opacity:1`);
                stops[1].setAttribute('style', `stop-color:${skyConfig.color2};stop-opacity:1`);
            }

            // Show/hide sun, moon, and stars
            if (sun) sun.style.display = skyConfig.showSun ? 'block' : 'none';
            if (moon) moon.style.display = skyConfig.showMoon ? 'block' : 'none';
            if (stars) stars.style.display = skyConfig.showStars ? 'block' : 'none';
        }

        // Setup outdoor lamppost double-click handler
        function setupLampostClickHandler() {
            const lampHousing = document.getElementById('lamp-housing');
            if (lampHousing) {
                lampHousing.addEventListener('dblclick', () => {
                    // Find the outdoor light
                    if (roomLights['Outdoor'] && roomLights['Outdoor'].length > 0) {
                        const outdoorLight = roomLights['Outdoor'][0];
                        toggleLight(outdoorLight.id, outdoorLight.on);
                    }
                });
            }
        }

        // Show all sensors and lights for debugging
        // showAllSensors();
        // showAllLights();

        // Fetch sunrise/sunset times for Chelmsford and update sky
        fetchSunTimes();

        // Load all data on page load
        loadTemperatures();
        loadLights().then(() => {
            // Setup lamppost click handler after lights are loaded
            setupLampostClickHandler();
        });
        loadMotionSensors();
        loadSensorDetails();
        updateWeatherDisplay();

        // Real-time polling with different intervals for different data types
        // Using IntervalManager for automatic cleanup on page unload
        // Motion sensors: every 3 seconds (critical for real-time detection)
        IntervalManager.register(loadMotionSensors, APP_CONFIG.intervals.motionSensors);

        // Lights: every 10 seconds (change frequently)
        IntervalManager.register(loadLights, APP_CONFIG.intervals.lights);

        // Sensor details: every 10 seconds (includes light levels, battery, motion)
        IntervalManager.register(loadSensorDetails, APP_CONFIG.intervals.sensorDetails);

        // Temperatures: every 60 seconds (change slowly, without sparkles to reduce visual noise)
        IntervalManager.register(() => loadTemperatures(false), APP_CONFIG.intervals.temperatures);

        // Update motion log display every minute to refresh "time ago"
        IntervalManager.register(updateMotionLogDisplay, APP_CONFIG.intervals.motionLog);

        // Update sky every minute to check for time of day changes
        IntervalManager.register(updateSky, APP_CONFIG.intervals.sky);

        // Refresh sunrise/sunset times once per day (every 24 hours)
        IntervalManager.register(fetchSunTimes, APP_CONFIG.intervals.sunTimes);

        // Weather: every 15 minutes (API rate limit friendly)
        IntervalManager.register(updateWeatherDisplay, APP_CONFIG.intervals.weather);

        // ============================================================================
        // FUN LIGHT EFFECTS
        // ============================================================================

        let originalLightStates = {};
        let effectInProgress = false;

        // Helper: Get all lights with their current state
        async function getAllLights() {
            try {
                const response = await fetch(`http://${BRIDGE_IP}/api/${USERNAME}/lights`);
                if (!response.ok) return null;
                return await response.json();
            } catch (error) {
                Logger.error('Error getting lights:', error);
                return null;
            }
        }

        // Helper: Set a light to specific state
        async function setLightState(lightId, state) {
            try {
                await fetch(`http://${BRIDGE_IP}/api/${USERNAME}/lights/${lightId}/state`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(state)
                });
            } catch (error) {
                Logger.error(`Error setting light ${lightId}:`, error);
            }
        }

        // Helper: Save current state of all lights
        async function saveLightStates() {
            const lights = await getAllLights();
            if (!lights) return false;

            originalLightStates = {};
            for (const [lightId, light] of Object.entries(lights)) {
                originalLightStates[lightId] = {
                    on: light.state.on,
                    bri: light.state.bri,
                    hue: light.state.hue,
                    sat: light.state.sat
                };
            }
            return true;
        }

        // Helper: Restore original light states
        async function restoreLightStates() {
            for (const [lightId, state] of Object.entries(originalLightStates)) {
                await setLightState(lightId, state);
                await new Promise(resolve => setTimeout(resolve, 50)); // Small delay between commands
            }
            setTimeout(loadLights, 500); // Refresh UI
            effectInProgress = false;
        }

        // Helper: Disable all effect buttons
        function disableEffectButtons(disable) {
            const buttons = ['redAlertBtn', 'partyBtn', 'discoBtn', 'waveBtn', 'sunsetBtn'];
            buttons.forEach(btnId => {
                const btn = document.getElementById(btnId);
                if (btn) btn.disabled = disable;
            });
        }

        // Helper: Confirm light effect with time-based warning
        function confirmEffect(effectName) {
            const hour = new Date().getHours();
            const isNightTime = hour >= 22 || hour < 7; // 10pm to 7am

            let message = `Run ${effectName} effect?\n\nThis will change all lights in your home.`;

            if (isNightTime) {
                message += `\n\n⚠️ WARNING: It's currently ${hour}:00 - people may be sleeping!`;
            }

            return confirm(message);
        }

        // Wrapper function to handle common light effect boilerplate
        async function runLightEffect(effectName, effectCallback) {
            if (!confirmEffect(effectName)) return;
            if (effectInProgress) return;
            effectInProgress = true;
            disableEffectButtons(true);

            try {
                const success = await saveLightStates();
                if (!success) {
                    effectInProgress = false;
                    disableEffectButtons(false);
                    return;
                }

                const lights = await getAllLights();
                if (!lights) {
                    effectInProgress = false;
                    disableEffectButtons(false);
                    return;
                }

                // Run the actual effect logic
                await effectCallback(lights);

                // Restore original states
                await restoreLightStates();
            } finally {
                effectInProgress = false;
                disableEffectButtons(false);
            }
        }

        // 🚨 RED ALERT - Flash all lights red
        async function redAlert() {
            return runLightEffect('Red Alert', async (lights) => {
                // Flash red 6 times (3 seconds total)
                for (let i = 0; i < 6; i++) {
                    // Turn all lights red and bright
                    for (const lightId of Object.keys(lights)) {
                        await setLightState(lightId, {
                            on: true,
                            bri: 254,
                            hue: 0, // Red
                            sat: 254,
                            transitiontime: 0 // Instant
                        });
                    }

                    await new Promise(resolve => setTimeout(resolve, 250));

                    // Turn all lights off briefly
                    for (const lightId of Object.keys(lights)) {
                        await setLightState(lightId, { on: false, transitiontime: 0 });
                    }

                    await new Promise(resolve => setTimeout(resolve, 250));
                }
            });
        }

        // 🎉 PARTY MODE - Cycle through rainbow colors
        async function partyMode() {
            return runLightEffect('Party Mode', async (lights) => {
                // Rainbow colors (hue values in Philips Hue scale: 0-65535)
                const colors = [
                    0,      // Red
                    10922,  // Orange
                    12750,  // Yellow
                    25500,  // Green
                    46920,  // Blue
                    56100   // Purple
                ];

                // Cycle through colors for 6 seconds
                for (let cycle = 0; cycle < 12; cycle++) {
                    const hue = colors[cycle % colors.length];

                    for (const lightId of Object.keys(lights)) {
                        await setLightState(lightId, {
                            on: true,
                            bri: 254,
                            hue: hue,
                            sat: 254,
                            transitiontime: 5 // Smooth transition
                        });
                    }

                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            });
        }

        // 🕺 DISCO - Random flashing colors
        async function discoMode() {
            return runLightEffect('Disco', async (lights) => {
                const lightIds = Object.keys(lights);

                // Random flashing for 5 seconds
                for (let i = 0; i < 20; i++) {
                    // Each light gets a random color
                    for (const lightId of lightIds) {
                        const randomHue = Math.floor(Math.random() * 65535);
                        const randomOn = Math.random() > 0.3; // 70% chance to be on

                        await setLightState(lightId, {
                            on: randomOn,
                            bri: randomOn ? 254 : 0,
                            hue: randomHue,
                            sat: 254,
                            transitiontime: 0
                        });
                    }

                    await new Promise(resolve => setTimeout(resolve, 250));
                }
            });
        }

        // 🌊 WAVE - Lights turn on in sequence
        async function waveEffect() {
            return runLightEffect('Wave', async (lights) => {
                const lightIds = Object.keys(lights);

                // Turn all lights off first
                for (const lightId of lightIds) {
                    await setLightState(lightId, { on: false, transitiontime: 0 });
                }

                await new Promise(resolve => setTimeout(resolve, 300));

                // Wave through lights 3 times
                for (let wave = 0; wave < 3; wave++) {
                    for (const lightId of lightIds) {
                        // Turn this light on with cyan color
                        await setLightState(lightId, {
                            on: true,
                            bri: 254,
                            hue: 46920, // Cyan/Blue
                            sat: 254,
                            transitiontime: 0
                        });

                        await new Promise(resolve => setTimeout(resolve, 150));

                        // Turn it back off
                        await setLightState(lightId, { on: false, transitiontime: 2 });
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 500));
            });
        }

        // 🌅 SUNSET - Gradual warm orange glow then fade
        async function sunsetMode() {
            return runLightEffect('Sunset', async (lights) => {
                // Fade to warm sunset orange
                for (const lightId of Object.keys(lights)) {
                    await setLightState(lightId, {
                        on: true,
                        bri: 200,
                        hue: 5000, // Warm orange
                        sat: 200,
                        transitiontime: 30 // 3 seconds fade in
                    });
                }

                await new Promise(resolve => setTimeout(resolve, 3500));

                // Hold for 2 seconds
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Fade to dim
                for (const lightId of Object.keys(lights)) {
                    await setLightState(lightId, {
                        on: true,
                        bri: 1,
                        transitiontime: 30 // 3 seconds fade out
                    });
                }

                await new Promise(resolve => setTimeout(resolve, 3500));
            });
        }

        // ============================================================================
        // PIXEL ART MOOSE CHARACTER SYSTEM
        // ============================================================================

        const MOOSE_CONFIG = {
            MIN_INTERVAL: 10 * 60 * 1000,      // 10 minutes
            MAX_INTERVAL: 20 * 60 * 1000,      // 20 minutes
            ENABLE_NIGHT_ACTIVITIES: true,      // Allow star gazing
            ENABLE_EFFECTS: true,               // Enable special effects
            WALK_IN_DURATION: 2000,            // Entry animation duration
            WALK_OUT_DURATION: 2000,           // Exit animation duration
            DEBUG_MODE: true,                  // Use shorter intervals for testing (CHANGE TO false FOR PRODUCTION)
        };

        // Debug mode uses 30-60 second intervals
        if (MOOSE_CONFIG.DEBUG_MODE) {
            MOOSE_CONFIG.MIN_INTERVAL = 30 * 1000;
            MOOSE_CONFIG.MAX_INTERVAL = 60 * 1000;
        }

        const mooseLocations = {
            garden: {
                tree: { x: 40, y: 480 },              // Under the tree for picnic/stargazing
                lamppost: { x: 110, y: 520 },         // By lamppost for reading
                flowers: { x: 720, y: 510 }           // Near flowers for watering
            },
            house: {
                frontDoor: { x: 160, y: 480 },        // Next to front door for painting
                window1: { x: 300, y: 380 },          // Right next to ground floor window
                window2: { x: 500, y: 380 },          // Right next to middle window
                window3: { x: 720, y: 380 },          // Right next to right window
                gardenEdge: { x: 80, y: 520 }         // On grass area for mowing
            }
        };

        const mooseActivities = [
            {
                name: 'cleaningWindows',
                locations: ['house.window1', 'house.window2', 'house.window3'],
                duration: 20000,
                emoji: '🧽'
            },
            {
                name: 'mowingLawn',
                locations: ['house.gardenEdge'],
                duration: 25000,
                emoji: '🌱'
            },
            {
                name: 'wateringPlants',
                locations: ['garden.flowers'],
                duration: 18000,
                emoji: '💧'
            },
            {
                name: 'havingPicnic',
                locations: ['garden.tree'],
                duration: 30000,
                emoji: '🧺'
            },
            {
                name: 'readingNewspaper',
                locations: ['garden.lamppost'],
                duration: 22000,
                emoji: '📰'
            },
            {
                name: 'paintingHouse',
                locations: ['house.frontDoor'],
                duration: 25000,
                emoji: '🎨'
            },
            {
                name: 'starGazing',
                locations: ['garden.tree'],
                duration: 35000,
                nightOnly: true,
                emoji: '🔭'
            }
        ];

        let mooseState = {
            isActive: false,
            currentActivity: null,
            nextAppearanceTime: null,
            currentTimeout: null
        };

        function createMooseCharacter(activityName, x, y) {
            const svgNS = 'http://www.w3.org/2000/svg';
            const mooseGroup = document.createElementNS(svgNS, 'g');
            mooseGroup.setAttribute('id', 'active-moose');
            mooseGroup.setAttribute('transform', `translate(${x}, ${y})`);

            // Antlers
            const antler1 = document.createElementNS(svgNS, 'rect');
            antler1.setAttribute('x', '8');
            antler1.setAttribute('y', '0');
            antler1.setAttribute('width', '12');
            antler1.setAttribute('height', '4');
            antler1.setAttribute('fill', '#654321');
            mooseGroup.appendChild(antler1);

            const antler1a = document.createElementNS(svgNS, 'rect');
            antler1a.setAttribute('x', '4');
            antler1a.setAttribute('y', '4');
            antler1a.setAttribute('width', '8');
            antler1a.setAttribute('height', '4');
            antler1a.setAttribute('fill', '#654321');
            mooseGroup.appendChild(antler1a);

            const antler2 = document.createElementNS(svgNS, 'rect');
            antler2.setAttribute('x', '28');
            antler2.setAttribute('y', '0');
            antler2.setAttribute('width', '12');
            antler2.setAttribute('height', '4');
            antler2.setAttribute('fill', '#654321');
            mooseGroup.appendChild(antler2);

            const antler2a = document.createElementNS(svgNS, 'rect');
            antler2a.setAttribute('x', '36');
            antler2a.setAttribute('y', '4');
            antler2a.setAttribute('width', '8');
            antler2a.setAttribute('height', '4');
            antler2a.setAttribute('fill', '#654321');
            mooseGroup.appendChild(antler2a);

            // Head
            const head = document.createElementNS(svgNS, 'rect');
            head.setAttribute('x', '12');
            head.setAttribute('y', '8');
            head.setAttribute('width', '24');
            head.setAttribute('height', '24');
            head.setAttribute('fill', '#8B4513');
            mooseGroup.appendChild(head);

            // Snout
            const snout = document.createElementNS(svgNS, 'rect');
            snout.setAttribute('x', '8');
            snout.setAttribute('y', '20');
            snout.setAttribute('width', '12');
            snout.setAttribute('height', '12');
            snout.setAttribute('fill', '#A0522D');
            mooseGroup.appendChild(snout);

            // Eyes
            const eye1 = document.createElementNS(svgNS, 'rect');
            eye1.setAttribute('x', '16');
            eye1.setAttribute('y', '16');
            eye1.setAttribute('width', '4');
            eye1.setAttribute('height', '4');
            eye1.setAttribute('fill', '#2C1507');
            mooseGroup.appendChild(eye1);

            const eye2 = document.createElementNS(svgNS, 'rect');
            eye2.setAttribute('x', '28');
            eye2.setAttribute('y', '16');
            eye2.setAttribute('width', '4');
            eye2.setAttribute('height', '4');
            eye2.setAttribute('fill', '#2C1507');
            mooseGroup.appendChild(eye2);

            // Nose
            const nose = document.createElementNS(svgNS, 'rect');
            nose.setAttribute('x', '8');
            nose.setAttribute('y', '24');
            nose.setAttribute('width', '4');
            nose.setAttribute('height', '4');
            nose.setAttribute('fill', '#2C1507');
            mooseGroup.appendChild(nose);

            // Body
            const body = document.createElementNS(svgNS, 'rect');
            body.setAttribute('x', '8');
            body.setAttribute('y', '32');
            body.setAttribute('width', '32');
            body.setAttribute('height', '32');
            body.setAttribute('fill', '#8B4513');
            mooseGroup.appendChild(body);

            // Legs
            const leg1 = document.createElementNS(svgNS, 'rect');
            leg1.setAttribute('x', '12');
            leg1.setAttribute('y', '64');
            leg1.setAttribute('width', '8');
            leg1.setAttribute('height', '24');
            leg1.setAttribute('fill', '#654321');
            mooseGroup.appendChild(leg1);

            const leg2 = document.createElementNS(svgNS, 'rect');
            leg2.setAttribute('x', '28');
            leg2.setAttribute('y', '64');
            leg2.setAttribute('width', '8');
            leg2.setAttribute('height', '24');
            leg2.setAttribute('fill', '#654321');
            mooseGroup.appendChild(leg2);

            // Tail
            const tail = document.createElementNS(svgNS, 'rect');
            tail.setAttribute('x', '40');
            tail.setAttribute('y', '44');
            tail.setAttribute('width', '8');
            tail.setAttribute('height', '12');
            tail.setAttribute('fill', '#654321');
            mooseGroup.appendChild(tail);

            // Add activity-specific props
            const props = getActivityProps(activityName, svgNS);
            if (props) {
                mooseGroup.appendChild(props);
            }

            // Add speech bubble (will be shown briefly)
            const speechBubble = createSpeechBubble(svgNS);
            speechBubble.setAttribute('id', 'moose-speech');
            mooseGroup.appendChild(speechBubble);

            return mooseGroup;
        }

        function createSpeechBubble(svgNS) {
            const bubbleGroup = document.createElementNS(svgNS, 'g');
            bubbleGroup.setAttribute('transform', 'translate(50, -30)');

            // Bubble background
            const bubble = document.createElementNS(svgNS, 'rect');
            bubble.setAttribute('x', '0');
            bubble.setAttribute('y', '0');
            bubble.setAttribute('width', '100');
            bubble.setAttribute('height', '32');
            bubble.setAttribute('rx', '8');
            bubble.setAttribute('fill', 'white');
            bubble.setAttribute('stroke', '#2C3E50');
            bubble.setAttribute('stroke-width', '2');
            bubbleGroup.appendChild(bubble);

            // Tail
            const tail = document.createElementNS(svgNS, 'polygon');
            tail.setAttribute('points', '20,32 15,40 30,32');
            tail.setAttribute('fill', 'white');
            tail.setAttribute('stroke', '#2C3E50');
            tail.setAttribute('stroke-width', '2');
            bubbleGroup.appendChild(tail);

            // Text
            const text = document.createElementNS(svgNS, 'text');
            text.setAttribute('x', '50');
            text.setAttribute('y', '20');
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-family', 'Arial, sans-serif');
            text.setAttribute('font-size', '12');
            text.setAttribute('font-weight', 'bold');
            text.setAttribute('fill', '#2C3E50');
            text.textContent = "It's me Monty!";
            bubbleGroup.appendChild(text);

            // Animation
            bubbleGroup.style.animation = 'speech-bubble-appear 4s ease-out forwards';

            return bubbleGroup;
        }

        function getActivityProps(activityName, svgNS) {
            const propsGroup = document.createElementNS(svgNS, 'g');
            propsGroup.setAttribute('class', 'moose-activity-prop');

            switch (activityName) {
                case 'cleaningWindows':
                    // Bucket (on ground)
                    const bucket = document.createElementNS(svgNS, 'rect');
                    bucket.setAttribute('x', '-20');
                    bucket.setAttribute('y', '70');
                    bucket.setAttribute('width', '16');
                    bucket.setAttribute('height', '16');
                    bucket.setAttribute('fill', '#4682B4');
                    propsGroup.appendChild(bucket);

                    // Handle
                    const handle = document.createElementNS(svgNS, 'rect');
                    handle.setAttribute('x', '-16');
                    handle.setAttribute('y', '68');
                    handle.setAttribute('width', '8');
                    handle.setAttribute('height', '2');
                    handle.setAttribute('fill', '#2C3E50');
                    propsGroup.appendChild(handle);

                    // Sponge (in moose's "hand")
                    const sponge = document.createElementNS(svgNS, 'rect');
                    sponge.setAttribute('x', '42');
                    sponge.setAttribute('y', '36');
                    sponge.setAttribute('width', '10');
                    sponge.setAttribute('height', '8');
                    sponge.setAttribute('fill', '#FFD700');
                    propsGroup.appendChild(sponge);
                    break;

                case 'mowingLawn':
                    // Lawn mower body
                    const mowerBody = document.createElementNS(svgNS, 'rect');
                    mowerBody.setAttribute('x', '-28');
                    mowerBody.setAttribute('y', '72');
                    mowerBody.setAttribute('width', '24');
                    mowerBody.setAttribute('height', '16');
                    mowerBody.setAttribute('fill', '#DC143C');
                    propsGroup.appendChild(mowerBody);

                    // Wheels
                    const wheel1 = document.createElementNS(svgNS, 'circle');
                    wheel1.setAttribute('cx', '-22');
                    wheel1.setAttribute('cy', '88');
                    wheel1.setAttribute('r', '4');
                    wheel1.setAttribute('fill', '#2C3E50');
                    propsGroup.appendChild(wheel1);

                    const wheel2 = document.createElementNS(svgNS, 'circle');
                    wheel2.setAttribute('cx', '-10');
                    wheel2.setAttribute('cy', '88');
                    wheel2.setAttribute('r', '4');
                    wheel2.setAttribute('fill', '#2C3E50');
                    propsGroup.appendChild(wheel2);
                    break;

                case 'wateringPlants':
                    // Watering can body
                    const canBody = document.createElementNS(svgNS, 'rect');
                    canBody.setAttribute('x', '42');
                    canBody.setAttribute('y', '38');
                    canBody.setAttribute('width', '20');
                    canBody.setAttribute('height', '14');
                    canBody.setAttribute('fill', '#5DADE2');
                    propsGroup.appendChild(canBody);

                    // Spout
                    const spout = document.createElementNS(svgNS, 'rect');
                    spout.setAttribute('x', '62');
                    spout.setAttribute('y', '44');
                    spout.setAttribute('width', '8');
                    spout.setAttribute('height', '3');
                    spout.setAttribute('fill', '#5DADE2');
                    propsGroup.appendChild(spout);

                    // Handle
                    const canHandle = document.createElementNS(svgNS, 'rect');
                    canHandle.setAttribute('x', '48');
                    canHandle.setAttribute('y', '34');
                    canHandle.setAttribute('width', '2');
                    canHandle.setAttribute('height', '8');
                    canHandle.setAttribute('fill', '#2874A6');
                    propsGroup.appendChild(canHandle);
                    break;

                case 'havingPicnic':
                    // Blanket (checkered)
                    for (let i = 0; i < 4; i++) {
                        for (let j = 0; j < 4; j++) {
                            if ((i + j) % 2 === 0) {
                                const square = document.createElementNS(svgNS, 'rect');
                                square.setAttribute('x', (50 + i * 8).toString());
                                square.setAttribute('y', (74 + j * 8).toString());
                                square.setAttribute('width', '8');
                                square.setAttribute('height', '8');
                                square.setAttribute('fill', '#E74C3C');
                                propsGroup.appendChild(square);
                            }
                        }
                    }

                    // Basket
                    const basket = document.createElementNS(svgNS, 'rect');
                    basket.setAttribute('x', '66');
                    basket.setAttribute('y', '82');
                    basket.setAttribute('width', '16');
                    basket.setAttribute('height', '12');
                    basket.setAttribute('fill', '#8B4513');
                    propsGroup.appendChild(basket);
                    break;

                case 'readingNewspaper':
                    // Newspaper
                    const paper = document.createElementNS(svgNS, 'rect');
                    paper.setAttribute('x', '46');
                    paper.setAttribute('y', '32');
                    paper.setAttribute('width', '18');
                    paper.setAttribute('height', '24');
                    paper.setAttribute('fill', '#BDC3C7');
                    propsGroup.appendChild(paper);

                    // Text lines
                    for (let i = 0; i < 5; i++) {
                        const line = document.createElementNS(svgNS, 'rect');
                        line.setAttribute('x', '48');
                        line.setAttribute('y', (36 + i * 4).toString());
                        line.setAttribute('width', '14');
                        line.setAttribute('height', '1');
                        line.setAttribute('fill', '#2C3E50');
                        propsGroup.appendChild(line);
                    }
                    break;

                case 'paintingHouse':
                    // Paint bucket
                    const paintBucket = document.createElementNS(svgNS, 'rect');
                    paintBucket.setAttribute('x', '-20');
                    paintBucket.setAttribute('y', '76');
                    paintBucket.setAttribute('width', '14');
                    paintBucket.setAttribute('height', '12');
                    paintBucket.setAttribute('fill', '#95A5A6');
                    propsGroup.appendChild(paintBucket);

                    // Paint brush
                    const brushHandle = document.createElementNS(svgNS, 'rect');
                    brushHandle.setAttribute('x', '44');
                    brushHandle.setAttribute('y', '24');
                    brushHandle.setAttribute('width', '3');
                    brushHandle.setAttribute('height', '20');
                    brushHandle.setAttribute('fill', '#8B4513');
                    propsGroup.appendChild(brushHandle);

                    const brushHead = document.createElementNS(svgNS, 'rect');
                    brushHead.setAttribute('x', '42');
                    brushHead.setAttribute('y', '44');
                    brushHead.setAttribute('width', '7');
                    brushHead.setAttribute('height', '8');
                    brushHead.setAttribute('fill', '#ECF0F1');
                    propsGroup.appendChild(brushHead);
                    break;

                case 'starGazing':
                    // Telescope
                    const telescopeStand = document.createElementNS(svgNS, 'rect');
                    telescopeStand.setAttribute('x', '58');
                    telescopeStand.setAttribute('y', '60');
                    telescopeStand.setAttribute('width', '3');
                    telescopeStand.setAttribute('height', '28');
                    telescopeStand.setAttribute('fill', '#2C3E50');
                    propsGroup.appendChild(telescopeStand);

                    const telescopeTube = document.createElementNS(svgNS, 'rect');
                    telescopeTube.setAttribute('x', '54');
                    telescopeTube.setAttribute('y', '44');
                    telescopeTube.setAttribute('width', '24');
                    telescopeTube.setAttribute('height', '6');
                    telescopeTube.setAttribute('fill', '#34495E');
                    propsGroup.appendChild(telescopeTube);
                    break;
            }

            return propsGroup;
        }

        function showMoose() {
            if (mooseState.isActive) return;

            // Select random activity
            const activity = selectRandomActivity();
            if (!activity) {
                scheduleMooseAppearance();
                return;
            }

            // Select random location for that activity
            const locationKey = activity.locations[Math.floor(Math.random() * activity.locations.length)];
            const [category, place] = locationKey.split('.');
            const location = mooseLocations[category][place];

            Logger.info(`🫎 Moose appearing! Activity: ${activity.name} at ${locationKey}`);

            // Monty announces his arrival!
            announceMoose();

            // Create moose with props
            const mooseElement = createMooseCharacter(activity.name, location.x, location.y);

            // Add to SVG container
            const container = document.getElementById('moose-container');
            container.appendChild(mooseElement);

            mooseState.isActive = true;
            mooseState.currentActivity = activity.name;

            // Trigger entry animation
            mooseElement.style.animation = `moose-walk-in ${MOOSE_CONFIG.WALK_IN_DURATION}ms ease-out`;

            // After entry, start activity animation
            setTimeout(() => {
                startActivityAnimation(mooseElement, activity.name, location);
            }, MOOSE_CONFIG.WALK_IN_DURATION);

            // Schedule exit
            setTimeout(() => {
                removeMoose(mooseElement);
            }, activity.duration);
        }

        function selectRandomActivity() {
            // Check if it's night (sun is hidden)
            const sun = document.getElementById('sun');
            const isNight = sun && sun.style.display === 'none';

            let available = mooseActivities.filter(a =>
                !a.nightOnly || (a.nightOnly && isNight)
            );

            if (available.length === 0) return null;

            return available[Math.floor(Math.random() * available.length)];
        }

        function startActivityAnimation(element, activityName, location) {
            const activityElement = element.querySelector('.moose-activity-prop');

            // Add gentle bobbing to moose
            element.style.animation = 'moose-bob 2s ease-in-out infinite';

            if (activityElement) {
                switch (activityName) {
                    case 'cleaningWindows':
                        activityElement.style.animation = 'window-clean 2s ease-in-out infinite';
                        // Add window brightening effect
                        if (MOOSE_CONFIG.ENABLE_EFFECTS) {
                            const windows = document.querySelectorAll('rect[fill="#87CEEB"]');
                            windows.forEach(w => {
                                w.style.animation = 'window-brighten 3s ease-in-out infinite';
                            });
                        }
                        break;
                    case 'wateringPlants':
                        activityElement.style.animation = 'water-pour 2s ease-in-out infinite';
                        // Add flower bouncing effect
                        if (MOOSE_CONFIG.ENABLE_EFFECTS) {
                            const flowers = document.querySelectorAll('g[transform*="750, 598"] circle');
                            flowers.forEach(f => {
                                f.style.animation = 'flower-bounce 1.5s ease-in-out infinite';
                            });
                        }
                        break;
                    case 'mowingLawn':
                        activityElement.style.animation = 'mow-forward 8s linear';
                        // Add grass pulsing effect
                        if (MOOSE_CONFIG.ENABLE_EFFECTS) {
                            const grass = document.querySelector('rect[fill="url(#grassGradient)"]');
                            if (grass) {
                                grass.style.animation = 'grass-pulse 2s ease-in-out infinite';
                            }
                        }
                        break;
                    case 'readingNewspaper':
                        activityElement.style.animation = 'read-newspaper 3s ease-in-out infinite';
                        break;
                    case 'paintingHouse':
                        activityElement.style.animation = 'paint-brush 1.5s ease-in-out infinite';
                        break;
                    case 'starGazing':
                        activityElement.style.animation = 'telescope-pan 4s ease-in-out alternate infinite';
                        // Enhance star twinkling
                        if (MOOSE_CONFIG.ENABLE_EFFECTS) {
                            const stars = document.querySelectorAll('circle[fill="#FFFFFF"]');
                            stars.forEach(s => {
                                s.style.filter = 'brightness(1.5)';
                            });
                        }
                        break;
                }
            }
        }

        function removeMoose(element) {
            element.style.animation = `moose-walk-out ${MOOSE_CONFIG.WALK_OUT_DURATION}ms ease-in`;

            setTimeout(() => {
                element.remove();
                mooseState.isActive = false;
                mooseState.currentActivity = null;

                // Clean up effects
                if (MOOSE_CONFIG.ENABLE_EFFECTS) {
                    const windows = document.querySelectorAll('rect[fill="#87CEEB"]');
                    windows.forEach(w => { w.style.animation = ''; });

                    const flowers = document.querySelectorAll('g[transform*="750, 598"] circle');
                    flowers.forEach(f => { f.style.animation = ''; });

                    const grass = document.querySelector('rect[fill="url(#grassGradient)"]');
                    if (grass) grass.style.animation = '';

                    const stars = document.querySelectorAll('circle[fill="#FFFFFF"]');
                    stars.forEach(s => { s.style.filter = ''; });
                }

                Logger.info('🫎 Moose left!');
                scheduleMooseAppearance();
            }, MOOSE_CONFIG.WALK_OUT_DURATION);
        }

        function scheduleMooseAppearance() {
            const minInterval = MOOSE_CONFIG.MIN_INTERVAL;
            const maxInterval = MOOSE_CONFIG.MAX_INTERVAL;
            const randomInterval = Math.floor(Math.random() * (maxInterval - minInterval)) + minInterval;

            mooseState.currentTimeout = setTimeout(() => {
                showMoose();
            }, randomInterval);

            mooseState.nextAppearanceTime = Date.now() + randomInterval;
            localStorage.setItem('mooseNextAppearance', mooseState.nextAppearanceTime);

            const minutes = Math.round(randomInterval / 60000);
            Logger.info(`🫎 Next moose appearance in ~${minutes} minutes`);
        }

        function handleVisibilityChange() {
            if (document.hidden) {
                // Page hidden - save state
                if (mooseState.currentTimeout) {
                    clearTimeout(mooseState.currentTimeout);
                    localStorage.setItem('mooseNextAppearance', mooseState.nextAppearanceTime);
                }
            } else {
                // Page visible - restore state
                const savedTime = localStorage.getItem('mooseNextAppearance');
                if (savedTime && !mooseState.isActive) {
                    const timeRemaining = parseInt(savedTime) - Date.now();
                    if (timeRemaining > 0) {
                        mooseState.currentTimeout = setTimeout(showMoose, timeRemaining);
                        const minutes = Math.round(timeRemaining / 60000);
                        Logger.info(`🫎 Moose will appear in ~${minutes} minutes`);
                    } else {
                        scheduleMooseAppearance();
                    }
                }
            }
        }

        function announceMoose() {
            // Use Web Speech API for Monty's voice announcement
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance();
                utterance.text = "It's me, Monty!";
                utterance.rate = 0.9;
                utterance.pitch = 1.1;
                utterance.volume = 0.8;

                // Try to use a friendly voice
                const voices = speechSynthesis.getVoices();
                const preferredVoice = voices.find(voice =>
                    voice.name.includes('Google UK English Male') ||
                    voice.name.includes('Daniel') ||
                    voice.lang.startsWith('en')
                );
                if (preferredVoice) {
                    utterance.voice = preferredVoice;
                }

                speechSynthesis.speak(utterance);
            }
        }

        function initMooseSystem() {
            Logger.info('🫎 Moose system initialized!');
            Logger.info(`   Debug mode: ${MOOSE_CONFIG.DEBUG_MODE ? 'ON (30-60 sec)' : 'OFF (10-20 min)'}`);

            // Add visibility change listener
            document.addEventListener('visibilitychange', handleVisibilityChange);

            // Schedule first appearance
            scheduleMooseAppearance();
        }

        // Initialize moose system
        initMooseSystem();

        // ============================================================================
        // GOOGLE NEST THERMOSTAT INTEGRATION
        // ============================================================================

        let nestDevices = [];
        let nestAccessToken = NEST_CONFIG?.access_token;
        let nestTokenExpiry = NEST_CONFIG?.expires_at;

        async function refreshNestToken() {
            Logger.info('🌡️  Refreshing Nest access token...');

            const tokenData = new URLSearchParams({
                client_id: NEST_CONFIG.CLIENT_ID,
                client_secret: NEST_CONFIG.CLIENT_SECRET,
                refresh_token: NEST_CONFIG.refresh_token,
                grant_type: 'refresh_token'
            }).toString();

            try {
                const response = await fetch('https://www.googleapis.com/oauth2/v4/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: tokenData
                });

                const tokens = await response.json();

                if (tokens.access_token) {
                    nestAccessToken = tokens.access_token;
                    nestTokenExpiry = Date.now() + (tokens.expires_in * 1000);
                    Logger.success('✓ Nest token refreshed');
                    return true;
                } else {
                    Logger.error('✗ Failed to refresh Nest token:', tokens);
                    return false;
                }
            } catch (error) {
                Logger.error('✗ Error refreshing Nest token:', error);
                return false;
            }
        }

        async function fetchNestDevices() {
            // Check if token needs refresh (refresh 5 min before expiry)
            if (Date.now() > (nestTokenExpiry - 5 * 60 * 1000)) {
                const refreshed = await refreshNestToken();
                if (!refreshed) return null;
            }

            try {
                const response = await fetch(
                    `https://smartdevicemanagement.googleapis.com/v1/enterprises/${NEST_CONFIG.PROJECT_ID}/devices`,
                    {
                        headers: {
                            'Authorization': `Bearer ${nestAccessToken}`
                        }
                    }
                );

                if (!response.ok) {
                    Logger.error('✗ Nest API error:', response.status);
                    return null;
                }

                const data = await response.json();
                return data.devices || [];
            } catch (error) {
                Logger.error('✗ Error fetching Nest devices:', error);
                return null;
            }
        }

        async function setNestTemperature(targetTempC) {
            if (nestDevices.length === 0) {
                Logger.error('No Nest devices found');
                return false;
            }

            // Check if token needs refresh
            if (Date.now() > (nestTokenExpiry - 5 * 60 * 1000)) {
                const refreshed = await refreshNestToken();
                if (!refreshed) return false;
            }

            const device = nestDevices[0]; // First device
            const deviceName = device.name; // Full device resource name

            Logger.info(`🌡️  Setting Nest temperature to ${targetTempC}°C...`);

            try {
                const response = await fetch(
                    `https://smartdevicemanagement.googleapis.com/v1/${deviceName}:executeCommand`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${nestAccessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            command: 'sdm.devices.commands.ThermostatTemperatureSetpoint.SetHeat',
                            params: {
                                heatCelsius: targetTempC
                            }
                        })
                    }
                );

                if (!response.ok) {
                    const error = await response.text();
                    Logger.error('✗ Failed to set temperature:', error);
                    return false;
                }

                Logger.info(`✓ Temperature set to ${targetTempC}°C`);

                // Log the temperature change
                logThermostatEvent(targetTempC);

                // Update display immediately
                setTimeout(updateNestDisplay, 2000);

                return true;
            } catch (error) {
                Logger.error('✗ Error setting temperature:', error);
                return false;
            }
        }

        async function updateNestDisplay() {
            const devices = await fetchNestDevices();

            if (!devices || devices.length === 0) {
                return;
            }

            nestDevices = devices;

            // Update each Nest device
            devices.forEach((device, index) => {
                const tempTrait = device.traits['sdm.devices.traits.Temperature'];
                const infoTrait = device.traits['sdm.devices.traits.Info'];
                const thermostatTrait = device.traits['sdm.devices.traits.ThermostatTemperatureSetpoint'];

                if (tempTrait) {
                    const tempC = tempTrait.ambientTemperatureCelsius;
                    const deviceName = infoTrait?.customName || `Nest ${index + 1}`;

                    Logger.info(`🌡️  ${deviceName}: ${tempC.toFixed(1)}°C`);

                    // Display in the stats
                    displayNestInStats(deviceName, tempC, thermostatTrait);
                }
            });
        }

        function displayNestInStats(name, tempC, thermostatTrait) {
            // Nest data now shown in Sensor Details panel, not in stat card
            // But we still need to update the visual thermostat display in the house

            Logger.info(`🌡️ displayNestInStats called: ${name}, ${tempC}°C`);

            let targetTempValue = null;
            let status = 'OFF';
            let statusColor = 'transparent';

            if (thermostatTrait?.heatCelsius) {
                targetTempValue = thermostatTrait.heatCelsius;
                // Check if heating
                if (tempC < thermostatTrait.heatCelsius - 0.5) {
                    status = 'HEATING';
                    statusColor = '#FF6B35'; // Orange
                } else {
                    status = 'IDLE';
                    statusColor = '#4CAF50'; // Green
                }
            } else if (thermostatTrait?.coolCelsius) {
                targetTempValue = thermostatTrait.coolCelsius;
                // Check if cooling
                if (tempC > thermostatTrait.coolCelsius + 0.5) {
                    status = 'COOLING';
                    statusColor = '#4ECDC4'; // Blue
                } else {
                    status = 'IDLE';
                    statusColor = '#4CAF50'; // Green
                }
            }

            // Update the visual Nest thermostat display in the lounge
            updateNestVisualDisplay(tempC, targetTempValue, status, statusColor);
        }

        function updateNestVisualDisplay(currentTemp, targetTemp, status, statusColor) {
            const currentTempEl = document.getElementById('nest-current-temp');
            const targetTempEl = document.getElementById('nest-target-temp');
            const statusTextEl = document.getElementById('nest-status-text');
            const statusRingEl = document.getElementById('nest-status-ring');
            const displayBgEl = document.getElementById('nest-display-bg');

            if (!currentTempEl) {
                Logger.warn('⚠️ Nest visual display elements not found in DOM');
                return; // Display not ready yet
            }

            // Update current temperature (large center number)
            currentTempEl.textContent = currentTemp.toFixed(1) + '°';

            // Update target temperature (small top number)
            if (targetTemp) {
                targetTempEl.textContent = '→ ' + targetTemp.toFixed(1) + '°';
                targetTempEl.setAttribute('fill', '#888888');
            } else {
                targetTempEl.textContent = '';
            }

            // Update status text
            statusTextEl.textContent = status;

            // Update status ring color (heating/cooling indicator)
            statusRingEl.setAttribute('stroke', statusColor);

            // Update display background with subtle glow
            if (status === 'HEATING') {
                displayBgEl.setAttribute('fill', '#1a0f00'); // Slight orange glow
                currentTempEl.setAttribute('fill', '#FFB84D'); // Orange text
            } else if (status === 'COOLING') {
                displayBgEl.setAttribute('fill', '#001a1a'); // Slight blue glow
                currentTempEl.setAttribute('fill', '#66D9EF'); // Blue text
            } else {
                displayBgEl.setAttribute('fill', '#000000'); // Pure black
                currentTempEl.setAttribute('fill', '#FFFFFF'); // White text
            }
        }

        function initNestIntegration() {
            if (!NEST_CONFIG || !NEST_CONFIG.access_token) {
                Logger.info('⚠️  Nest not configured. Run nest-auth.js to set up.');
                return;
            }

            Logger.info('🌡️  Nest integration initialized');

            // Make Nest thermostat draggable
            const nestDisplay = document.getElementById('nest-thermostat-display');
            if (nestDisplay) {
                makeNestDraggable(nestDisplay);
            }

            // Initial fetch
            updateNestDisplay();

            // Update every 15 minutes (reduced from 5 to avoid 429 rate limits)
            IntervalManager.register(updateNestDisplay, APP_CONFIG.intervals.nest);
        }

        function makeNestDraggable(group) {
            let isDragging = false;
            let isAdjustingTemp = false;
            let startX, startY, currentTransform;
            let startTemp, currentAdjustedTemp;

            group.style.cursor = 'pointer';

            // Load saved position from localStorage
            loadSavedPosition(group, 'nestThermostatPosition');

            // Get current target temperature from device
            function getCurrentTargetTemp() {
                if (nestDevices.length === 0) return 21; // Default
                const device = nestDevices[0];
                const thermostatTrait = device.traits['sdm.devices.traits.ThermostatTemperatureSetpoint'];
                return thermostatTrait?.heatCelsius || thermostatTrait?.coolCelsius || 21;
            }

            // Unified start handler for both mouse and touch
            function handleStart(e) {
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;

                startX = clientX;
                startY = clientY;

                // Check if Shift key is pressed for position dragging
                if (e.shiftKey) {
                    isDragging = true;
                    const transform = group.getAttribute('transform');
                    const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                    currentTransform = {
                        x: parseFloat(match[1]),
                        y: parseFloat(match[2])
                    };
                    group.style.cursor = 'move';
                    group.style.opacity = '0.7';
                } else {
                    // Temperature adjustment mode (default)
                    isAdjustingTemp = true;
                    startTemp = getCurrentTargetTemp();
                    currentAdjustedTemp = startTemp;

                    // Visual feedback
                    const statusRing = document.getElementById('nest-status-ring');
                    if (statusRing) {
                        statusRing.setAttribute('stroke', '#4A90E2');
                        statusRing.setAttribute('opacity', '0.8');
                    }
                }

                e.preventDefault();
                e.stopPropagation();
            }

            // Unified move handler
            function handleMove(e) {
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;

                if (isDragging) {
                    // Position dragging (Shift+drag)
                    const dx = clientX - startX;
                    const dy = clientY - startY;
                    const newX = currentTransform.x + dx;
                    const newY = currentTransform.y + dy;
                    group.setAttribute('transform', `translate(${newX}, ${newY})`);
                } else if (isAdjustingTemp) {
                    // Temperature adjustment (normal drag)
                    const dy = startY - clientY; // Inverted: drag up = increase

                    // Each 10 pixels of drag = 0.5°C change
                    const tempChange = Math.round(dy / 10) * 0.5;
                    currentAdjustedTemp = Math.max(10, Math.min(30, startTemp + tempChange));

                    // Update display in real-time
                    const targetTempEl = document.getElementById('nest-target-temp');
                    const currentTempEl = document.getElementById('nest-current-temp');
                    if (targetTempEl && currentTempEl) {
                        targetTempEl.textContent = `SET: ${currentAdjustedTemp.toFixed(1)}°C`;
                        targetTempEl.setAttribute('fill', '#4A90E2');
                        targetTempEl.setAttribute('font-size', '12');
                        currentTempEl.setAttribute('font-size', '24'); // Make current temp smaller
                    }
                }
            }

            // Unified end handler
            async function handleEnd(e) {
                if (isDragging) {
                    // Save position
                    isDragging = false;
                    group.style.opacity = '1';
                    group.style.cursor = 'pointer';

                    const transform = group.getAttribute('transform');
                    const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                    const position = {
                        x: parseFloat(match[1]),
                        y: parseFloat(match[2])
                    };
                    localStorage.setItem('nestThermostatPosition', JSON.stringify(position));
                    Logger.info('🌡️  Nest position saved:', position);
                } else if (isAdjustingTemp) {
                    // Apply temperature change
                    isAdjustingTemp = false;

                    // Reset visual feedback
                    const statusRing = document.getElementById('nest-status-ring');
                    if (statusRing) {
                        statusRing.setAttribute('opacity', '0.6');
                    }

                    // Only send command if temperature actually changed
                    if (Math.abs(currentAdjustedTemp - startTemp) >= 0.5) {
                        Logger.info(`🌡️  Setting Nest temperature to ${currentAdjustedTemp}°C`);
                        await setNestTemperature(currentAdjustedTemp);
                    } else {
                        // No change, restore display
                        updateNestDisplay();
                    }
                }
            }

            // Add both mouse and touch event listeners
            group.addEventListener('mousedown', handleStart);
            group.addEventListener('touchstart', handleStart, { passive: false });

            document.addEventListener('mousemove', handleMove);
            document.addEventListener('touchmove', handleMove, { passive: false });

            document.addEventListener('mouseup', handleEnd);
            document.addEventListener('touchend', handleEnd);
        }

        // Initialize Nest integration
        initNestIntegration();

        // Expose Nest control function globally for console access
        window.setNestTemp = setNestTemperature;

        // ==============================================
        // SONOS SPEAKER INTEGRATION
        // ==============================================

        const SONOS_SPEAKERS = [
            { ip: '192.168.68.61', room: 'Bedroom', coords: {x: 680, y: 400} },
            { ip: '192.168.68.64', room: 'Lounge', coords: {x: 380, y: 400} },
            { ip: '192.168.68.60', room: 'Lounge', coords: {x: 420, y: 400} } // Beam (only show one in lounge)
        ];

        let sonosStates = {};

        async function fetchSonosState(speaker) {
            try {
                const response = await fetch(`/sonos/${speaker.ip}/state`);
                const data = await response.json();
                return data;
            } catch (err) {
                // Silently fail - just return no playback
                return { state: 'STOPPED', track: null };
            }
        }

        async function updateSonosDisplay() {
            for (const speaker of SONOS_SPEAKERS) {
                const state = await fetchSonosState(speaker);
                sonosStates[speaker.room] = state;

                // Update music note indicator in the room
                updateMusicIndicator(speaker.room, state.state === 'PLAYING', speaker.coords);
            }

            // Update stats card
            displaySonosInStats();
        }

        function updateMusicIndicator(room, isPlaying, coords) {
            const indicatorId = `music-indicator-${room}`;
            let indicator = document.getElementById(indicatorId);

            if (isPlaying) {
                if (!indicator) {
                    // Create music note indicator
                    const container = document.getElementById('light-indicators-container');
                    indicator = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    indicator.id = indicatorId;
                    indicator.setAttribute('transform', `translate(${coords.x}, ${coords.y})`);

                    // Animated music notes
                    indicator.innerHTML = `
                        <text class="music-note" x="0" y="0" font-size="24" fill="#FF1493" opacity="0.9">🎵</text>
                        <text class="music-note" x="15" y="-10" font-size="18" fill="#FF69B4" opacity="0.7" style="animation: float-note 2s ease-in-out infinite;">🎶</text>
                    `;

                    container.appendChild(indicator);
                }
            } else {
                // Remove indicator if exists
                if (indicator) {
                    indicator.remove();
                }
            }
        }

        function displaySonosInStats() {
            // Sonos data now shown in Sensor Details panel, not here
            // Skip creating stat card in stats-grid
            return;

            let sonosCard = document.getElementById('sonos-stat-card');

            if (!sonosCard) {
                const statsGrid = document.querySelector('.stats-grid');
                sonosCard = document.createElement('div');
                sonosCard.id = 'sonos-stat-card';
                sonosCard.className = 'stat-card';
                statsGrid.appendChild(sonosCard);
            }

            // Find what's currently playing
            let nowPlaying = '';
            for (const [room, state] of Object.entries(sonosStates)) {
                if (state.state === 'PLAYING' && state.track) {
                    nowPlaying = `${state.track}`;
                    break; // Just show one
                }
            }

            if (!nowPlaying) {
                nowPlaying = 'Nothing playing';
            }

            sonosCard.innerHTML = `
                <div class="stat-label">🎵 Sonos</div>
                <div class="stat-value" style="font-size: 14px;">${nowPlaying}</div>
            `;
        }

        // ============================================================================
        // SONOS DIRECT CONTROL FUNCTIONS
        // ============================================================================

        // Sonos IPs from config
        const BEDROOM_SONOS_IP = HOUSE_CONFIG.devices.sonos.bedroom;
        const OFFICE_SONOS_IP = HOUSE_CONFIG.devices.sonos.office;
        const LOUNGE_SONOS_IP = HOUSE_CONFIG.devices.sonos.lounge;

        const SONOS_ROOMS = [
            { name: 'bedroom', ip: BEDROOM_SONOS_IP, controlsId: 'sonos-bedroom-controls', storageKey: 'sonosBedroomPosition', labelId: 'sonos-bedroom-volume-label', x: 180, y: 280 },
            { name: 'office', ip: OFFICE_SONOS_IP, controlsId: 'sonos-office-controls', storageKey: 'sonosOfficePosition', labelId: 'sonos-office-volume-label', x: 500, y: 280 },
            { name: 'lounge', ip: LOUNGE_SONOS_IP, controlsId: 'sonos-lounge-controls', storageKey: 'sonosLoungePosition', labelId: 'sonos-lounge-volume-label', x: 400, y: 520 }
        ];

        async function sonosSoapRequest(ip, path, soapAction, soapBody) {
            try {
                // Use proxy server to avoid CORS issues
                const proxyUrl = `${APP_CONFIG.proxies.sonos}${path}`;

                const response = await fetch(proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/xml; charset="utf-8"',
                        'SOAPAction': soapAction,
                        'X-Sonos-IP': ip  // Tell proxy which speaker to target
                    },
                    body: soapBody
                });

                const text = await response.text();
                return { ok: response.ok, status: response.status, body: text };
            } catch (error) {
                Logger.error('✗ Sonos SOAP request failed:', error);
                return { ok: false, error: error.message };
            }
        }

        // Sonos SOAP command templates
        const SONOS_COMMANDS = {
            Play: {
                service: 'AVTransport',
                path: '/MediaRenderer/AVTransport/Control',
                params: { InstanceID: 0, Speed: 1 }
            },
            Pause: {
                service: 'AVTransport',
                path: '/MediaRenderer/AVTransport/Control',
                params: { InstanceID: 0 }
            },
            GetVolume: {
                service: 'RenderingControl',
                path: '/MediaRenderer/RenderingControl/Control',
                params: { InstanceID: 0, Channel: 'Master' }
            },
            SetVolume: {
                service: 'RenderingControl',
                path: '/MediaRenderer/RenderingControl/Control',
                params: { InstanceID: 0, Channel: 'Master', DesiredVolume: null }
            }
        };

        // Build SOAP XML from template
        function buildSoapXml(action, service, params) {
            const xmlns = service === 'AVTransport' ? 'urn:schemas-upnp-org:service:AVTransport:1' : 'urn:schemas-upnp-org:service:RenderingControl:1';

            let paramsXml = '';
            for (const [key, value] of Object.entries(params)) {
                if (value !== null) {
                    paramsXml += `      <${key}>${value}</${key}>\n`;
                }
            }

            return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:${action} xmlns:u="${xmlns}">
${paramsXml.trimEnd()}
    </u:${action}>
  </s:Body>
</s:Envelope>`;
        }

        // Generic Sonos command function
        async function sonosCommand(ip, commandName, extraParams = {}) {
            const template = SONOS_COMMANDS[commandName];
            if (!template) {
                Logger.error(`Unknown Sonos command: ${commandName}`);
                return { ok: false, error: 'Unknown command' };
            }

            const params = { ...template.params, ...extraParams };
            const soapBody = buildSoapXml(commandName, template.service, params);
            const soapAction = `"urn:schemas-upnp-org:service:${template.service}:1#${commandName}"`;

            return await sonosSoapRequest(ip, template.path, soapAction, soapBody);
        }

        async function sonosPlay(ip) {
            const result = await sonosCommand(ip, 'Play');
            return result.ok;
        }

        async function sonosPause(ip) {
            const result = await sonosCommand(ip, 'Pause');
            return result.ok;
        }

        async function sonosGetVolume(ip) {
            const result = await sonosCommand(ip, 'GetVolume');
            if (result.ok) {
                const match = result.body.match(/<CurrentVolume>(\d+)<\/CurrentVolume>/);
                return match ? parseInt(match[1]) : 0;
            }
            return 0;
        }

        async function sonosSetVolume(ip, volume) {
            const result = await sonosCommand(ip, 'SetVolume', { DesiredVolume: volume });
            return result.ok;
        }

        async function sonosVolumeChange(ip, delta, labelId) {
            const currentVolume = await sonosGetVolume(ip);
            const newVolume = Math.max(0, Math.min(100, currentVolume + delta));
            await sonosSetVolume(ip, newVolume);
            await updateVolumeDisplay(ip, labelId);
        }

        async function updateVolumeDisplay(ip, labelId) {
            const volume = await sonosGetVolume(ip);
            const label = document.getElementById(labelId);
            if (label) {
                label.textContent = `Vol: ${volume}`;
            }
        }

        function makeSonosDraggable(group, storageKey) {
            createDraggable(group, {
                storageKey: storageKey,
                excludeSelector: '.sonos-button',
                cursor: 'grab',
                activeCursor: 'grabbing'
            });
        }

        function setupSonosRoom(config) {
            const panel = document.getElementById(config.controlsId);
            if (!panel) {
                Logger.error(`Panel not found: ${config.controlsId}`);
                return;
            }

            // Load saved position from localStorage
            loadSavedPosition(panel, config.storageKey);

            // Make panel draggable
            makeSonosDraggable(panel, config.storageKey);

            // Wire up controls
            const playBtn = document.getElementById(`sonos-${config.name}-play`);
            const pauseBtn = document.getElementById(`sonos-${config.name}-pause`);
            const volUpBtn = document.getElementById(`sonos-${config.name}-volup`);
            const volDownBtn = document.getElementById(`sonos-${config.name}-voldown`);

            Logger.info(`Setting up ${config.name}: play=${!!playBtn}, pause=${!!pauseBtn}, volUp=${!!volUpBtn}, volDown=${!!volDownBtn}`);

            if (playBtn) {
                playBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await sonosPlay(config.ip);
                });
            }

            if (pauseBtn) {
                pauseBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await sonosPause(config.ip);
                });
            }

            if (volUpBtn) {
                volUpBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await sonosVolumeChange(config.ip, 5, config.labelId);
                });
            }

            if (volDownBtn) {
                volDownBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await sonosVolumeChange(config.ip, -5, config.labelId);
                });
            }

            // Initial volume display
            updateVolumeDisplay(config.ip, config.labelId);
        }

        async function checkSonosProxyAvailability() {
            return await checkProxyAvailability(
                `${APP_CONFIG.proxies.sonos}/MediaRenderer/AVTransport/Control`,
                'Sonos'
            );
        }

        function disableSonosControls() {
            const controlIds = [
                'sonos-bedroom-controls',
                'sonos-office-controls',
                'sonos-lounge-controls'
            ];

            controlIds.forEach(id => {
                const panel = document.getElementById(id);
                if (panel) {
                    panel.style.opacity = '0.3';
                    panel.style.pointerEvents = 'none';
                    panel.style.cursor = 'not-allowed';
                }
            });
        }

        /**
         * Generate Sonos control panels dynamically
         */
        function generateSonosControls() {
            const container = document.getElementById('sonos-controls-container');
            if (!container) {
                Logger.error('Sonos controls container not found');
                return;
            }

            const SVG_NS = 'http://www.w3.org/2000/svg';

            SONOS_ROOMS.forEach(room => {
                // Create main group
                const group = document.createElementNS(SVG_NS, 'g');
                group.id = room.controlsId;
                group.setAttribute('transform', `translate(${room.x}, ${room.y})`);

                // Add all SVG elements
                group.innerHTML = `
                    <!-- Control Panel Background -->
                    <rect x="-35" y="-18" width="70" height="36" rx="5" fill="#2C3E50" opacity="0.85" stroke="#34495E" stroke-width="1.5"/>

                    <!-- Title -->
                    <text x="0" y="-8" text-anchor="middle" fill="#BDC3C7" font-size="7" font-weight="bold">SONOS</text>

                    <!-- Play Button -->
                    <g id="sonos-${room.name}-play" class="sonos-button" transform="translate(-20, 5)" style="cursor: pointer;">
                        <circle r="8" fill="#27AE60" stroke="#1E8449" stroke-width="1"/>
                        <polygon points="-2.5,-3.5 -2.5,3.5 3.5,0" fill="white"/>
                    </g>

                    <!-- Pause Button -->
                    <g id="sonos-${room.name}-pause" class="sonos-button" transform="translate(-5, 5)" style="cursor: pointer;">
                        <circle r="8" fill="#E67E22" stroke="#CA6F1E" stroke-width="1"/>
                        <rect x="-3" y="-3.5" width="2" height="7" fill="white"/>
                        <rect x="1" y="-3.5" width="2" height="7" fill="white"/>
                    </g>

                    <!-- Volume Down Button -->
                    <g id="sonos-${room.name}-voldown" class="sonos-button" transform="translate(10, 5)" style="cursor: pointer;">
                        <circle r="7" fill="#3498DB" stroke="#2980B9" stroke-width="1"/>
                        <text x="0" y="2.5" text-anchor="middle" fill="white" font-size="11" font-weight="bold">−</text>
                    </g>

                    <!-- Volume Up Button -->
                    <g id="sonos-${room.name}-volup" class="sonos-button" transform="translate(23, 5)" style="cursor: pointer;">
                        <circle r="7" fill="#3498DB" stroke="#2980B9" stroke-width="1"/>
                        <text x="0" y="2.5" text-anchor="middle" fill="white" font-size="10" font-weight="bold">+</text>
                    </g>

                    <!-- Volume Label -->
                    <text id="${room.labelId}" x="0" y="16" text-anchor="middle" fill="#ECF0F1" font-size="6">Vol: --</text>
                `;

                container.appendChild(group);
            });

            Logger.info(`Generated ${SONOS_ROOMS.length} Sonos control panels`);
        }

        async function initSonosIntegration() {
            // Check if proxy is available
            const proxyAvailable = await checkSonosProxyAvailability();
            if (!proxyAvailable) {
                disableSonosControls();
                return; // Don't set up event listeners if proxy isn't available
            }

            // Set up all Sonos rooms
            SONOS_ROOMS.forEach(room => setupSonosRoom(room));

            // Show Sonos card
            displaySonosInStats();
        }

        // Generate and initialize Sonos integration
        generateSonosControls();
        initSonosIntegration().catch(err => Logger.error('Failed to initialize Sonos:', err));

        // ============================================================================
        // TAPO SMART PLUG INTEGRATION
        // ============================================================================

        const TAPO_PROXY_URL = APP_CONFIG.proxies.tapo;
        const TAPO_PLUGS = HOUSE_CONFIG.devices.tapo || {};

        /**
         * Call Tapo proxy API
         */
        async function tapoRequest(endpoint, body = {}) {
            try {
                const response = await fetch(`${TAPO_PROXY_URL}${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                return await response.json();
            } catch (error) {
                Logger.error(`Tapo API error (${endpoint}):`, error);
                throw error;
            }
        }

        /**
         * Turn Tapo plug ON - now using TapoAPI module
         */
        async function tapoTurnOn(plugName) {
            return await TapoAPI.turnOn(plugName);
        }

        /**
         * Turn Tapo plug OFF - now using TapoAPI module
         */
        async function tapoTurnOff(plugName) {
            return await TapoAPI.turnOff(plugName);
        }

        /**
         * Get Tapo plug status - now using TapoAPI module
         */
        async function tapoGetStatus(plugName) {
            return await TapoAPI.getStatus(plugName);
        }

        /**
         * Update Tapo plug toggle visual state (UK socket style)
         */
        function updateTapoToggleVisual(plugName, isOn) {
            const toggleKnob = document.getElementById(`tapo-${plugName}-toggle-knob`);
            const toggleBg = document.getElementById(`tapo-${plugName}-toggle-bg`);
            const statusText = document.getElementById(`tapo-${plugName}-status-text`);
            const onLabel = document.getElementById(`tapo-${plugName}-on-label`);
            const offLabel = document.getElementById(`tapo-${plugName}-off-label`);
            const powerLed = document.getElementById(`tapo-${plugName}-power-led`);

            if (toggleKnob && toggleBg && statusText) {
                if (isOn) {
                    // ON state: rocker tilted up, red switch, LED on
                    toggleKnob.setAttribute('transform', 'rotate(-8)');
                    toggleBg.setAttribute('fill', '#CC0000');
                    toggleBg.setAttribute('stroke', '#AA0000');
                    statusText.textContent = 'ON';
                    statusText.setAttribute('fill', 'white');
                    if (onLabel) onLabel.setAttribute('opacity', '1');
                    if (offLabel) offLabel.setAttribute('opacity', '0.3');
                    if (powerLed) powerLed.setAttribute('opacity', '1');
                } else {
                    // OFF state: rocker tilted down, gray switch, LED off
                    toggleKnob.setAttribute('transform', 'rotate(8)');
                    toggleBg.setAttribute('fill', '#DDDDDD');
                    toggleBg.setAttribute('stroke', '#BBBBBB');
                    statusText.textContent = 'OFF';
                    statusText.setAttribute('fill', '#666666');
                    if (onLabel) onLabel.setAttribute('opacity', '0.3');
                    if (offLabel) offLabel.setAttribute('opacity', '1');
                    if (powerLed) powerLed.setAttribute('opacity', '0');
                }
            }
        }

        /**
         * Update Tapo plug status display
         */
        async function updateTapoStatus(plugName) {
            const status = await tapoGetStatus(plugName);

            if (status && status.success) {
                updateTapoToggleVisual(plugName, status.state === 'on');
            }
        }

        /**
         * Check if Tapo proxy is available - now using TapoAPI module
         */
        async function checkTapoProxyAvailability() {
            return await TapoAPI.checkAvailability();
        }

        /**
         * Disable Tapo controls (when proxy unavailable)
         */
        function disableTapoControls() {
            Object.keys(TAPO_PLUGS).forEach(plugName => {
                const controlId = `tapo-${plugName}-controls`;
                const panel = document.getElementById(controlId);
                if (panel) {
                    panel.style.opacity = '0.3';
                    panel.style.pointerEvents = 'none';
                    panel.style.cursor = 'not-allowed';
                }
            });
        }

        /**
         * Generate Tapo plug controls dynamically
         */
        function generateTapoPlugControls() {
            const container = document.getElementById('tapo-plugs-container');
            if (!container) {
                Logger.error('Tapo plugs container not found');
                return;
            }

            const SVG_NS = 'http://www.w3.org/2000/svg';

            Object.entries(TAPO_PLUGS).forEach(([plugName, config]) => {
                // Create main group
                const group = document.createElementNS(SVG_NS, 'g');
                group.id = `tapo-${plugName}-controls`;
                group.setAttribute('transform', `translate(${config.x}, ${config.y}) scale(0.7)`);

                // Add all SVG elements
                group.innerHTML = `
                    <!-- Title -->
                    <text x="0" y="-32" text-anchor="middle" fill="#ECF0F1" font-size="7" font-weight="bold">${config.label.toUpperCase()}</text>

                    <!-- UK Socket Faceplate (white/cream) -->
                    <rect x="-35" y="-25" width="70" height="60" rx="3" fill="#F5F5F5" stroke="#D0D0D0" stroke-width="2"/>

                    <!-- Socket cutout shadow (3D effect) -->
                    <rect x="-28" y="-10" width="56" height="35" rx="2" fill="#E0E0E0" opacity="0.8"/>

                    <!-- Three UK socket holes (rectangular pins) -->
                    <g id="socket-holes">
                        <!-- Earth pin (top, larger) -->
                        <rect x="-3" y="-8" width="6" height="10" rx="1" fill="#2C2C2C"/>
                        <!-- Live pin (bottom left) -->
                        <rect x="-15" y="8" width="6" height="10" rx="1" fill="#2C2C2C"/>
                        <!-- Neutral pin (bottom right) -->
                        <rect x="9" y="8" width="6" height="10" rx="1" fill="#2C2C2C"/>
                    </g>

                    <!-- Rocker Switch -->
                    <g id="tapo-${plugName}-toggle" class="tapo-toggle" style="cursor: pointer;" transform="translate(0, -18)">
                        <!-- Switch housing -->
                        <rect x="-12" y="-8" width="24" height="16" rx="2" fill="#333" stroke="#222" stroke-width="1"/>

                        <!-- Rocker switch (will rotate and change color) -->
                        <g id="tapo-${plugName}-toggle-knob">
                            <rect id="tapo-${plugName}-toggle-bg" x="-10" y="-6" width="20" height="12" rx="1.5" fill="#CC0000" stroke="#AA0000" stroke-width="1"/>
                            <!-- Switch text -->
                            <text id="tapo-${plugName}-status-text" x="0" y="1.5" text-anchor="middle" fill="white" font-size="6" font-weight="bold">--</text>
                        </g>
                    </g>

                    <!-- Power indicator LED -->
                    <circle id="tapo-${plugName}-power-led" cx="25" cy="-18" r="2.5" fill="#FF0000" opacity="0">
                        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite"/>
                    </circle>

                    <!-- ON/OFF labels on faceplate -->
                    <text id="tapo-${plugName}-on-label" x="0" y="-24" text-anchor="middle" fill="#666" font-size="4" font-weight="bold" opacity="0.5">ON</text>
                    <text id="tapo-${plugName}-off-label" x="0" y="-12" text-anchor="middle" fill="#666" font-size="4" font-weight="bold" opacity="0.5">OFF</text>

                    <!-- "13A" rating text (typical UK socket) -->
                    <text x="0" y="32" text-anchor="middle" fill="#999" font-size="5">13A</text>
                `;

                container.appendChild(group);
            });

            Logger.info(`Generated ${Object.keys(TAPO_PLUGS).length} Tapo plug controls`);
        }

        /**
         * Initialize Tapo integration
         */
        async function initTapoIntegration() {
            Logger.info('🔌 Initializing Tapo smart plug integration...');

            // Check if proxy is available
            const proxyAvailable = await checkTapoProxyAvailability();
            if (!proxyAvailable) {
                Logger.info('⚠️  Tapo proxy not running. Start with: node tapo-proxy.js');
                disableTapoControls();
                return;
            }

            // Initialize each plug
            for (const [plugName, config] of Object.entries(TAPO_PLUGS)) {
                const controlsId = `tapo-${plugName}-controls`;
                const toggleId = `tapo-${plugName}-toggle`;

                const panel = document.getElementById(controlsId);
                if (!panel) continue;

                Logger.info(`  Setting up ${plugName} (${config.label})...`);

                // Load saved position
                loadSavedPosition(panel, `tapo-${plugName}-position`);

                // Make draggable (exclude toggle from dragging)
                createDraggable(panel, {
                    storageKey: `tapo-${plugName}-position`,
                    excludeSelector: '.tapo-toggle',
                    cursor: 'grab',
                    activeCursor: 'grabbing'
                });

                // Wire up toggle switch
                const toggle = document.getElementById(toggleId);
                if (toggle) {
                    toggle.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        try {
                            // Get current status
                            const status = await tapoGetStatus(plugName);
                            const isCurrentlyOn = status?.state === 'on';

                            // Toggle to opposite state
                            if (isCurrentlyOn) {
                                await tapoTurnOff(plugName);
                            } else {
                                await tapoTurnOn(plugName);
                            }

                            // Update visual immediately with optimistic state
                            updateTapoToggleVisual(plugName, !isCurrentlyOn);

                            // Confirm with actual status after 1 second
                            setTimeout(() => updateTapoStatus(plugName), 1000);
                        } catch (error) {
                            Logger.error(`Error toggling ${plugName}:`, error);
                            // Refresh status on error to show true state
                            setTimeout(() => updateTapoStatus(plugName), 500);
                        }
                    });
                }

                // Initial status update
                updateTapoStatus(plugName);

                // Refresh status every 30 seconds
                IntervalManager.register(() => updateTapoStatus(plugName), APP_CONFIG.intervals.tapoStatus);
            }

            Logger.success('✓ Tapo integration initialized');
        }

        // Generate and initialize Tapo integration
        generateTapoPlugControls();
        initTapoIntegration().catch(err => Logger.error('Failed to initialize Tapo:', err));

        // ============================================================================
        // JUKEBOX LIGHT EFFECTS
        // ============================================================================

        function makeJukeboxDraggable(group, storageKey) {
            createDraggable(group, {
                storageKey: storageKey,
                excludeSelector: '.jukebox-button',
                cursor: 'grab',
                activeCursor: 'grabbing'
            });
        }

        function initJukebox() {
            Logger.info('🎵 Initializing jukebox...');

            const jukeboxPanel = document.getElementById('jukebox');

            // Load saved position from localStorage
            loadSavedPosition(jukeboxPanel, 'jukeboxPosition');

            // Make jukebox draggable
            if (jukeboxPanel) {
                makeJukeboxDraggable(jukeboxPanel, 'jukeboxPosition');
            }

            // Wire up jukebox buttons
            document.getElementById('jukebox-btn-1')?.addEventListener('click', (e) => {
                e.stopPropagation();
                Logger.info('🚨 Jukebox: Red Alert!');
                redAlert();
            });

            document.getElementById('jukebox-btn-2')?.addEventListener('click', (e) => {
                e.stopPropagation();
                Logger.info('🎉 Jukebox: Party Mode!');
                partyMode();
            });

            document.getElementById('jukebox-btn-3')?.addEventListener('click', (e) => {
                e.stopPropagation();
                Logger.info('🕺 Jukebox: Disco Mode!');
                discoMode();
            });

            document.getElementById('jukebox-btn-4')?.addEventListener('click', (e) => {
                e.stopPropagation();
                Logger.info('🌊 Jukebox: Wave Effect!');
                waveEffect();
            });

            document.getElementById('jukebox-btn-5')?.addEventListener('click', (e) => {
                e.stopPropagation();
                Logger.info('🌅 Jukebox: Sunset Mode!');
                sunsetMode();
            });

            Logger.success('✓ Jukebox initialized');
        }

        // Initialize jukebox
        initJukebox();

        // Weather panel draggable functionality
        function makeWeatherPanelDraggable(group, storageKey) {
            createDraggable(group, {
                storageKey: storageKey,
                cursor: 'grab',
                activeCursor: 'grabbing'
            });
        }

        function initWeatherPanel() {
            Logger.info('🌤️ Initializing weather panel...');

            const weatherPanel = document.getElementById('weather-info-panel');

            // Load saved position from localStorage
            loadSavedPosition(weatherPanel, 'weatherPanelPosition');

            // Make weather panel draggable
            if (weatherPanel) {
                makeWeatherPanelDraggable(weatherPanel, 'weatherPanelPosition');
            }

            Logger.success('✓ Weather panel initialized');
        }

        // Initialize weather panel
        initWeatherPanel();

        // Expose Sonos control functions globally (for console access)
        window.bedroomPlay = () => sonosPlay(BEDROOM_SONOS_IP);
        window.bedroomPause = () => sonosPause(BEDROOM_SONOS_IP);
        window.bedroomVolumeUp = () => sonosVolumeChange(BEDROOM_SONOS_IP, 5, 'sonos-bedroom-volume-label');
        window.bedroomVolumeDown = () => sonosVolumeChange(BEDROOM_SONOS_IP, -5, 'sonos-bedroom-volume-label');

        window.officePlay = () => sonosPlay(OFFICE_SONOS_IP);
        window.officePause = () => sonosPause(OFFICE_SONOS_IP);
        window.officeVolumeUp = () => sonosVolumeChange(OFFICE_SONOS_IP, 5, 'sonos-office-volume-label');
        window.officeVolumeDown = () => sonosVolumeChange(OFFICE_SONOS_IP, -5, 'sonos-office-volume-label');

        window.loungePlay = () => sonosPlay(LOUNGE_SONOS_IP);
        window.loungePause = () => sonosPause(LOUNGE_SONOS_IP);
        window.loungeVolumeUp = () => sonosVolumeChange(LOUNGE_SONOS_IP, 5, 'sonos-lounge-volume-label');
        window.loungeVolumeDown = () => sonosVolumeChange(LOUNGE_SONOS_IP, -5, 'sonos-lounge-volume-label');

        // ============================================================================
        // GOOGLE HOME HUB CONTROL FUNCTIONS
        // ============================================================================

        const HUB_IP = '192.168.68.62';
        const HUB_PORT = 8008;

        async function hubAnnounce() {
            const message = prompt('What would you like to announce?', 'Hello! This is a test announcement.');
            if (!message) return;

            try {
                Logger.info(`📢 Announcing to Hub: "${message}"`);

                // Use Google TTS URL
                const encodedMessage = encodeURIComponent(message);
                const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodedMessage}`;

                // Cast to Hub using Default Media Receiver
                const response = await fetch(`http://${HUB_IP}:${HUB_PORT}/apps/CC1AD845`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        type: 'LOAD',
                        autoplay: true,
                        media: {
                            contentId: ttsUrl,
                            contentType: 'audio/mp3',
                            streamType: 'BUFFERED'
                        }
                    })
                });

                if (response.ok) {
                    Logger.success('✓ Announcement sent');
                    alert('Announcement sent to Hub!');
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (error) {
                Logger.error('✗ Hub announce failed:', error);
                alert(`Failed to send announcement: ${error.message}`);
            }
        }

        async function hubStop() {
            try {
                Logger.info('🛑 Stopping Hub playback...');

                // Get current app status
                const statusResponse = await fetch(`http://${HUB_IP}:${HUB_PORT}/apps`);
                const statusText = await statusResponse.text();

                try {
                    const statusData = JSON.parse(statusText);
                    if (statusData.applications && statusData.applications.length > 0) {
                        const appId = statusData.applications[0].sessionId;

                        // Stop the app
                        await fetch(`http://${HUB_IP}:${HUB_PORT}/apps/${appId}`, {
                            method: 'DELETE'
                        });

                        Logger.success('✓ Playback stopped');
                        alert('Hub playback stopped');
                    } else {
                        alert('Hub is already idle');
                    }
                } catch (e) {
                    alert('Hub is already idle');
                }
            } catch (error) {
                Logger.error('✗ Hub stop failed:', error);
                alert(`Failed to stop Hub: ${error.message}`);
            }
        }

        async function hubYouTube() {
            const videoId = prompt('Enter YouTube video ID or URL:', 'dQw4w9WgXcQ');
            if (!videoId) return;

            try {
                // Extract video ID if full URL was provided
                let id = videoId;
                const urlMatch = videoId.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
                if (urlMatch) {
                    id = urlMatch[1];
                }

                Logger.info(`📺 Casting YouTube video ${id} to Hub...`);

                const response = await fetch(`http://${HUB_IP}:${HUB_PORT}/apps/YouTube`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        type: 'LOAD',
                        media: {
                            contentId: id,
                            streamType: 'BUFFERED',
                            contentType: 'video/mp4'
                        }
                    })
                });

                if (response.ok) {
                    Logger.success('✓ YouTube video casting');
                    alert(`Casting video ${id} to Hub!`);
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (error) {
                Logger.error('✗ Hub YouTube cast failed:', error);
                alert(`Failed to cast YouTube: ${error.message}`);
            }
        }

        async function hubShowDashboard() {
            try {
                // Get current page URL
                const dashboardUrl = window.location.href;

                Logger.info(`🏠 Displaying dashboard on Hub: ${dashboardUrl}`);

                const response = await fetch(`http://${HUB_IP}:${HUB_PORT}/apps/E8C28D3C`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        type: 'LOAD',
                        media: {
                            contentId: dashboardUrl,
                            contentType: 'text/html',
                            streamType: 'LIVE'
                        }
                    })
                });

                if (response.ok) {
                    Logger.success('✓ Dashboard displayed on Hub');
                    alert('Dashboard is now showing on Hub!');
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (error) {
                Logger.error('✗ Hub display dashboard failed:', error);
                alert(`Failed to display dashboard: ${error.message}`);
            }
        }

        // Export Hub functions to window
        window.hubAnnounce = hubAnnounce;
        window.hubStop = hubStop;
        window.hubYouTube = hubYouTube;
        window.hubShowDashboard = hubShowDashboard;

