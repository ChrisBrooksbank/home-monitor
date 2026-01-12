// NVIDIA SHIELD API Module
const ShieldAPI = {
    proxyUrl: APP_CONFIG.proxies.shield,

    /**
     * Check if SHIELD proxy is available
     */
    async checkAvailability() {
        return await checkProxyAvailability(
            `${this.proxyUrl}/health`,
            'SHIELD'
        );
    },

    /**
     * Get list of available apps
     */
    async getApps() {
        try {
            const response = await fetch(`${this.proxyUrl}/apps`, {
                method: 'GET',
                signal: AbortSignal.timeout(APP_CONFIG.timeouts.proxyCheck)
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            Logger.error('Failed to get SHIELD apps:', error.message);
            return { apps: [] };
        }
    },

    /**
     * Get SHIELD device info
     */
    async getInfo() {
        try {
            const response = await fetch(`${this.proxyUrl}/info`, {
                method: 'GET',
                signal: AbortSignal.timeout(APP_CONFIG.timeouts.apiRequest)
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            Logger.error('Failed to get SHIELD info:', error.message);
            return null;
        }
    },

    /**
     * Launch an app on the SHIELD
     * @param {string} appName - Name of the app to launch
     */
    async launchApp(appName) {
        Logger.info(`Launching ${appName} on SHIELD...`);
        try {
            const response = await fetch(`${this.proxyUrl}/launch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-App-Name': appName
                },
                signal: AbortSignal.timeout(APP_CONFIG.timeouts.apiRequest)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP ${response.status}`);
            }

            Logger.success(`${appName} launched on SHIELD`);
            return result;
        } catch (error) {
            Logger.error(`Failed to launch ${appName}:`, error.message);
            throw error;
        }
    },

    /**
     * Stop current app / return to home screen
     */
    async stop() {
        Logger.info('Stopping SHIELD app...');
        try {
            const response = await fetch(`${this.proxyUrl}/stop`, {
                method: 'POST',
                signal: AbortSignal.timeout(APP_CONFIG.timeouts.apiRequest)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP ${response.status}`);
            }

            Logger.success('SHIELD returned to home screen');
            return result;
        } catch (error) {
            Logger.error('Failed to stop SHIELD app:', error.message);
            throw error;
        }
    }
};

// Expose on window for global access
if (typeof window !== 'undefined') {
    window.ShieldAPI = ShieldAPI;
}

// Export for ES modules (Vitest)
export { ShieldAPI };
