/**
 * Philips Hue Bridge API Module
 * Handles all communication with the Hue Bridge
 */

// Get bridge configuration from global HUE_CONFIG
const getBridgeConfig = () => ({
    ip: window.HUE_CONFIG?.BRIDGE_IP || '192.168.68.51',
    username: window.HUE_CONFIG?.USERNAME || ''
});

/**
 * Hue API wrapper
 */
const HueAPI = {
    /**
     * Get the base URL for API calls
     */
    getBaseUrl() {
        const config = getBridgeConfig();
        return `http://${config.ip}/api/${config.username}`;
    },

    /**
     * Fetch all lights from the bridge
     * @returns {Promise<Object|null>} - Light data or null on error
     */
    async getAllLights() {
        try {
            const response = await fetch(`${this.getBaseUrl()}/lights`);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            Logger.error('Error getting lights:', error);
            return null;
        }
    },

    /**
     * Get a specific light
     * @param {string} lightId - Light ID
     * @returns {Promise<Object|null>} - Light data or null
     */
    async getLight(lightId) {
        try {
            const response = await fetch(`${this.getBaseUrl()}/lights/${lightId}`);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            Logger.error(`Error getting light ${lightId}:`, error);
            return null;
        }
    },

    /**
     * Set light state
     * @param {string} lightId - Light ID
     * @param {Object} state - State object (on, bri, hue, sat, etc.)
     * @returns {Promise<boolean>} - Success status
     */
    async setLightState(lightId, state) {
        try {
            const response = await fetch(`${this.getBaseUrl()}/lights/${lightId}/state`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state)
            });
            return response.ok;
        } catch (error) {
            Logger.error(`Error setting light ${lightId}:`, error);
            return false;
        }
    },

    /**
     * Toggle a light on/off
     * @param {string} lightId - Light ID
     * @param {boolean} currentState - Current on/off state
     * @returns {Promise<boolean>} - Success status
     */
    async toggleLight(lightId, currentState) {
        return await this.setLightState(lightId, { on: !currentState });
    },

    /**
     * Fetch all sensors from the bridge
     * @returns {Promise<Object|null>} - Sensor data or null on error
     */
    async getAllSensors() {
        try {
            const response = await fetch(`${this.getBaseUrl()}/sensors`);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            Logger.error('Error getting sensors:', error);
            return null;
        }
    },

    /**
     * Get temperature sensors
     * @returns {Promise<Array>} - Array of temperature sensor data
     */
    async getTemperatureSensors() {
        const sensors = await this.getAllSensors();
        if (!sensors) return [];

        const tempSensors = [];
        for (const [id, sensor] of Object.entries(sensors)) {
            if (sensor.type === 'ZLLTemperature' && sensor.state.temperature !== null) {
                tempSensors.push({
                    id,
                    name: sensor.name,
                    temperature: sensor.state.temperature / 100,
                    lastUpdated: sensor.state.lastupdated
                });
            }
        }
        return tempSensors;
    },

    /**
     * Get motion sensors
     * @returns {Promise<Array>} - Array of motion sensor data
     */
    async getMotionSensors() {
        const sensors = await this.getAllSensors();
        if (!sensors) return [];

        const motionSensors = [];
        for (const [id, sensor] of Object.entries(sensors)) {
            if (sensor.type === 'ZLLPresence') {
                motionSensors.push({
                    id,
                    name: sensor.name,
                    presence: sensor.state.presence,
                    lastUpdated: sensor.state.lastupdated,
                    battery: sensor.config?.battery
                });
            }
        }
        return motionSensors;
    },

    /**
     * Get light level sensors
     * @returns {Promise<Array>} - Array of light level sensor data
     */
    async getLightLevelSensors() {
        const sensors = await this.getAllSensors();
        if (!sensors) return [];

        const lightSensors = [];
        for (const [id, sensor] of Object.entries(sensors)) {
            if (sensor.type === 'ZLLLightLevel' && sensor.state.lightlevel !== null) {
                lightSensors.push({
                    id,
                    name: sensor.name,
                    lightLevel: sensor.state.lightlevel,
                    dark: sensor.state.dark,
                    daylight: sensor.state.daylight,
                    lastUpdated: sensor.state.lastupdated
                });
            }
        }
        return lightSensors;
    },

    /**
     * Discover Hue bridge on the network
     * Probes /api/config endpoint which requires no auth
     * @param {string} baseIp - Base IP (e.g., '192.168.68')
     * @param {number} start - Start of range
     * @param {number} end - End of range
     * @returns {Promise<Object|null>} - Bridge info or null
     */
    async discover(baseIp = '192.168.68', start = 50, end = 90) {
        Logger.info('Scanning for Hue bridges...');

        for (let i = start; i <= end; i++) {
            const ip = `${baseIp}.${i}`;
            try {
                const response = await fetch(`http://${ip}/api/config`, {
                    signal: AbortSignal.timeout(1500)
                });
                if (response.ok) {
                    const config = await response.json();
                    if (config.bridgeid && config.modelid) {
                        Logger.success(`Found Hue bridge: ${config.name} @ ${ip}`);
                        return {
                            ip,
                            name: config.name,
                            model: config.modelid,
                            bridgeId: config.bridgeid,
                            apiVersion: config.apiversion
                        };
                    }
                }
            } catch {
                // Continue scanning
            }
        }
        Logger.warn('No Hue bridge found');
        return null;
    },

    /**
     * Get bridge info (no auth required)
     * @returns {Promise<Object|null>} - Bridge config or null
     */
    async getBridgeInfo() {
        try {
            const config = getBridgeConfig();
            const response = await fetch(`http://${config.ip}/api/config`);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            Logger.error('Error getting bridge info:', error);
            return null;
        }
    }
};

// Expose on window for global access
window.HueAPI = HueAPI;

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HueAPI;
}
