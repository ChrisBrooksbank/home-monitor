// Tapo Smart Plug API Module
const TapoAPI = {
    proxyUrl: APP_CONFIG.proxies.tapo,

    /**
     * Make a request to the Tapo proxy
     */
    async request(endpoint, body = {}) {
        try {
            const response = await fetch(`${this.proxyUrl}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(APP_CONFIG.timeouts.apiRequest)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            Logger.error(`Tapo API error (${endpoint}):`, error.message);
            throw error;
        }
    },

    /**
     * Turn plug ON
     */
    async turnOn(plugName) {
        Logger.info(`Turning ON Tapo plug: ${plugName}`);
        try {
            const result = await retryWithBackoff(() =>
                this.request('/on', { plugName })
            );
            Logger.success(`${plugName} is now ON`);
            return result;
        } catch (error) {
            Logger.error(`Failed to turn on ${plugName}:`, error.message);
            throw error;
        }
    },

    /**
     * Turn plug OFF
     */
    async turnOff(plugName) {
        Logger.info(`Turning OFF Tapo plug: ${plugName}`);
        try {
            const result = await retryWithBackoff(() =>
                this.request('/off', { plugName })
            );
            Logger.success(`${plugName} is now OFF`);
            return result;
        } catch (error) {
            Logger.error(`Failed to turn off ${plugName}:`, error.message);
            throw error;
        }
    },

    /**
     * Get plug status
     */
    async getStatus(plugName) {
        try {
            const result = await this.request('/status', { plugName });
            return result;
        } catch (error) {
            Logger.error(`Failed to get status for ${plugName}:`, error.message);
            return null;
        }
    },

    /**
     * Toggle plug state
     */
    async toggle(plugName) {
        Logger.info(`Toggling Tapo plug: ${plugName}`);
        try {
            const status = await this.getStatus(plugName);
            const isOn = status?.state === 'on';

            if (isOn) {
                return await this.turnOff(plugName);
            } else {
                return await this.turnOn(plugName);
            }
        } catch (error) {
            Logger.error(`Failed to toggle ${plugName}:`, error.message);
            throw error;
        }
    },

    /**
     * Get list of configured plugs
     */
    async getPlugs() {
        try {
            const response = await fetch(`${this.proxyUrl}/plugs`, {
                method: 'GET',
                signal: AbortSignal.timeout(APP_CONFIG.timeouts.proxyCheck)
            });
            return await response.json();
        } catch (error) {
            Logger.error('Failed to get Tapo plugs:', error.message);
            return { plugs: {} };
        }
    },

    /**
     * Check if Tapo proxy is available
     */
    async checkAvailability() {
        return await checkProxyAvailability(
            `${this.proxyUrl}/plugs`,
            'Tapo'
        );
    }
};

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TapoAPI;
}
