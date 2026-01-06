/**
 * Nest Thermostat Integration Module
 * Handles Google Nest thermostat communication and display
 */

// Nest state
let nestDevices = [];
let nestAccessToken = null;
let nestTokenExpiry = 0;

// Get Nest configuration from global config
const getNestConfig = () => ({
    clientId: window.NEST_CONFIG?.CLIENT_ID,
    clientSecret: window.NEST_CONFIG?.CLIENT_SECRET,
    projectId: window.NEST_CONFIG?.PROJECT_ID,
    refreshToken: window.NEST_CONFIG?.refresh_token,
    accessToken: window.NEST_CONFIG?.access_token,
    expiresAt: window.NEST_CONFIG?.expires_at
});

/**
 * Initialize Nest tokens from config
 */
function initTokens() {
    const config = getNestConfig();
    nestAccessToken = config.accessToken;
    nestTokenExpiry = config.expiresAt || 0;
}

/**
 * Refresh Nest access token
 * @returns {Promise<boolean>} - Success status
 */
async function refreshNestToken() {
    const config = getNestConfig();
    Logger.info('Refreshing Nest access token...');

    const tokenData = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: 'refresh_token'
    }).toString();

    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v4/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: tokenData
        });

        const tokens = await response.json();

        if (tokens.access_token) {
            nestAccessToken = tokens.access_token;
            nestTokenExpiry = Date.now() + (tokens.expires_in * 1000);
            Logger.success('Nest token refreshed');
            return true;
        } else {
            Logger.error('Failed to refresh Nest token:', tokens);
            return false;
        }
    } catch (error) {
        Logger.error('Error refreshing Nest token:', error);
        return false;
    }
}

/**
 * Check if token needs refresh (5 min before expiry)
 * @returns {boolean}
 */
function tokenNeedsRefresh() {
    return Date.now() > (nestTokenExpiry - 5 * 60 * 1000);
}

/**
 * Fetch Nest devices from API
 * @returns {Promise<Array|null>} - Array of devices or null
 */
async function fetchNestDevices() {
    if (tokenNeedsRefresh()) {
        const refreshed = await refreshNestToken();
        if (!refreshed) return null;
    }

    const config = getNestConfig();

    try {
        const response = await fetch(
            `https://smartdevicemanagement.googleapis.com/v1/enterprises/${config.projectId}/devices`,
            {
                headers: { 'Authorization': `Bearer ${nestAccessToken}` }
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
 * @param {number} targetTempC - Target temperature in Celsius
 * @returns {Promise<boolean>} - Success status
 */
async function setNestTemperature(targetTempC) {
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
                    'Authorization': `Bearer ${nestAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    command: 'sdm.devices.commands.ThermostatTemperatureSetpoint.SetHeat',
                    params: { heatCelsius: targetTempC }
                })
            }
        );

        if (!response.ok) {
            const error = await response.text();
            Logger.error('Failed to set temperature:', error);
            return false;
        }

        Logger.info(`Temperature set to ${targetTempC}°C`);

        // Log the temperature change
        if (typeof logThermostatEvent === 'function') {
            logThermostatEvent(targetTempC);
        }

        return true;
    } catch (error) {
        Logger.error('Error setting temperature:', error);
        return false;
    }
}

/**
 * Get thermostat status from device traits
 * @param {Object} device - Nest device object
 * @returns {Object} - Status object
 */
function getThermostatStatus(device) {
    const tempTrait = device.traits['sdm.devices.traits.Temperature'];
    const thermostatTrait = device.traits['sdm.devices.traits.ThermostatTemperatureSetpoint'];
    const humidityTrait = device.traits['sdm.devices.traits.Humidity'];
    const infoTrait = device.traits['sdm.devices.traits.Info'];
    const modeTrait = device.traits['sdm.devices.traits.ThermostatMode'];

    const result = {
        name: infoTrait?.customName || 'Nest Thermostat',
        currentTemp: tempTrait?.ambientTemperatureCelsius || null,
        targetTemp: null,
        humidity: humidityTrait?.ambientHumidityPercent || null,
        mode: modeTrait?.mode?.toUpperCase() || 'OFF',
        status: 'OFF',
        statusColor: '#999'
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
 * @param {number} currentTemp - Current temperature
 * @param {number|null} targetTemp - Target temperature
 * @param {string} status - Status text
 * @param {string} statusColor - Status color
 */
function updateNestVisualDisplay(currentTemp, targetTemp, status, statusColor) {
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
    if (targetTemp) {
        targetTempEl.textContent = '→ ' + targetTemp.toFixed(1) + '°';
        targetTempEl.setAttribute('fill', '#888888');
    } else {
        targetTempEl.textContent = '';
    }

    // Update status
    statusTextEl.textContent = status;
    statusRingEl.setAttribute('stroke', statusColor);

    // Update display background
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

/**
 * Update Nest display with fresh data
 */
async function updateNestDisplay() {
    const devices = await fetchNestDevices();

    if (!devices || devices.length === 0) {
        return;
    }

    devices.forEach((device) => {
        const status = getThermostatStatus(device);

        if (status.currentTemp) {
            Logger.info(`${status.name}: ${status.currentTemp.toFixed(1)}°C`);
            updateNestVisualDisplay(
                status.currentTemp,
                status.targetTemp,
                status.status,
                status.statusColor
            );
        }
    });
}

/**
 * Make Nest thermostat draggable with temperature adjustment
 * @param {SVGElement} group - The Nest thermostat SVG group
 */
function makeNestDraggable(group) {
    let isDragging = false;
    let isAdjustingTemp = false;
    let startX, startY, currentTransform;
    let startTemp, currentAdjustedTemp;

    group.style.cursor = 'pointer';

    // Load saved position
    const savedPosition = localStorage.getItem('nestThermostatPosition');
    if (savedPosition) {
        const position = JSON.parse(savedPosition);
        group.setAttribute('transform', `translate(${position.x}, ${position.y})`);
    }

    function getCurrentTargetTemp() {
        if (nestDevices.length === 0) return 21;
        const device = nestDevices[0];
        const thermostatTrait = device.traits['sdm.devices.traits.ThermostatTemperatureSetpoint'];
        return thermostatTrait?.heatCelsius || thermostatTrait?.coolCelsius || 21;
    }

    function handleStart(e) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        startX = clientX;
        startY = clientY;

        if (e.shiftKey) {
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
                y: match ? parseFloat(match[2]) : 0
            };
            group.style.cursor = 'move';
            group.style.opacity = '0.7';
        }

        e.preventDefault();
        e.stopPropagation();
    }

    function handleMove(e) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

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

    async function handleEnd() {
        if (isDragging) {
            isDragging = false;
            group.style.opacity = '1';
            group.style.cursor = 'pointer';

            const transform = group.getAttribute('transform');
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
 * @param {Object} intervalManager - Interval manager for polling
 * @param {number} pollInterval - Polling interval in ms
 */
function initNestIntegration(intervalManager, pollInterval = 15 * 60 * 1000) {
    const config = getNestConfig();

    if (!config.accessToken) {
        Logger.info('Nest not configured. Run nest-auth.js to set up.');
        return;
    }

    initTokens();
    Logger.info('Nest integration initialized');

    // Make thermostat draggable
    const nestDisplay = document.getElementById('nest-thermostat-display');
    if (nestDisplay) {
        makeNestDraggable(nestDisplay);
    }

    // Initial fetch
    updateNestDisplay();

    // Register polling interval
    if (intervalManager) {
        intervalManager.register(updateNestDisplay, pollInterval);
    }

    // Expose for console access
    window.setNestTemp = setNestTemperature;
}

/**
 * Get current Nest devices
 * @returns {Array} - Nest devices
 */
function getDevices() {
    return nestDevices;
}

// Expose for other scripts
window.NestIntegration = {
    init: initNestIntegration,
    fetchDevices: fetchNestDevices,
    setTemperature: setNestTemperature,
    updateDisplay: updateNestDisplay,
    getDevices: getDevices
};

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initNestIntegration(IntervalManager, APP_CONFIG.intervals.nest);
    });
} else {
    initNestIntegration(IntervalManager, APP_CONFIG.intervals.nest);
}
