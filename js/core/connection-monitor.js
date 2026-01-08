/**
 * Connection Monitor Module
 * Handles health checks and reconnection logic for all services
 * (Hue Bridge, Sonos, Tapo, SHIELD proxies)
 */

(function() {
    'use strict';

    // =============================================================================
    // STATE
    // =============================================================================

    const connectionStatus = {
        hue: { online: false, lastCheck: null, name: null, apiVersion: null },
        sonos: { online: false, lastCheck: null, uptime: null },
        tapo: { online: false, lastCheck: null, uptime: null },
        shield: { online: false, lastCheck: null, uptime: null }
    };

    // Guard flag to prevent overlapping checks
    let isCheckingConnections = false;

    // =============================================================================
    // UTILITY FUNCTIONS
    // =============================================================================

    /**
     * Format uptime seconds into human-readable string
     * @param {number} seconds - Uptime in seconds
     * @returns {string} Formatted uptime string
     */
    function formatUptime(seconds) {
        if (!seconds) return 'unknown';
        if (seconds < 60) return `${Math.floor(seconds)}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
        return `${Math.floor(seconds / 86400)}d`;
    }

    /**
     * Update a status indicator element
     * @param {string} id - Element ID
     * @param {string} state - 'checking', 'online', or 'offline'
     * @param {string} [title] - Optional tooltip text
     */
    function updateIndicator(id, state, title) {
        const indicator = document.getElementById(id);
        if (!indicator) return;

        indicator.classList.remove('online', 'offline', 'checking');
        indicator.classList.add(state);
        if (title) indicator.title = title;
    }

    // =============================================================================
    // HEALTH CHECK FUNCTIONS
    // =============================================================================

    /**
     * Check Hue bridge connectivity
     * Uses /api/config endpoint which requires no authentication
     * @returns {Promise<boolean>} True if bridge is online
     */
    async function checkHueBridgeHealth() {
        const BRIDGE_IP = window.HUE_CONFIG?.BRIDGE_IP || '192.168.68.51';

        updateIndicator('status-hue', 'checking');

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), APP_CONFIG.timeouts.proxyCheck);

            const response = await fetch(`http://${BRIDGE_IP}/api/config`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                // Verify it's actually a Hue bridge by checking for bridgeid
                if (data.bridgeid) {
                    const wasOffline = !connectionStatus.hue.online;
                    connectionStatus.hue = {
                        online: true,
                        lastCheck: new Date(),
                        name: data.name,
                        apiVersion: data.apiversion
                    };
                    updateIndicator('status-hue', 'online',
                        `Hue Bridge: ${data.name} (API v${data.apiversion})`);

                    // Emit event if status changed
                    if (wasOffline && window.AppEvents) {
                        AppEvents.emit('connection:hue:online', {
                            name: data.name,
                            apiVersion: data.apiversion
                        });
                    }
                    return true;
                }
            }
        } catch (error) {
            // Bridge is offline or unreachable
        }

        const wasOnline = connectionStatus.hue.online;
        connectionStatus.hue = {
            online: false,
            lastCheck: new Date(),
            name: null,
            apiVersion: null
        };
        updateIndicator('status-hue', 'offline',
            `Hue Bridge: Offline - check connection to ${window.HUE_CONFIG?.BRIDGE_IP || '192.168.68.51'}`);

        // Emit event if status changed
        if (wasOnline && window.AppEvents) {
            AppEvents.emit('connection:hue:offline', {
                bridgeIp: window.HUE_CONFIG?.BRIDGE_IP || '192.168.68.51'
            });
        }
        return false;
    }

    /**
     * Check proxy server health
     * @param {string} proxyName - Name of the proxy (sonos, tapo, shield)
     * @param {string} url - Base URL of the proxy
     * @returns {Promise<boolean>} True if proxy is online
     */
    async function checkProxyHealth(proxyName, url) {
        updateIndicator(`status-${proxyName}`, 'checking');

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), APP_CONFIG.timeouts.proxyCheck);

            const response = await fetch(`${url}/health`, { signal: controller.signal });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                const wasOffline = !connectionStatus[proxyName].online;
                connectionStatus[proxyName] = {
                    online: true,
                    lastCheck: new Date(),
                    uptime: data.uptime
                };
                updateIndicator(`status-${proxyName}`, 'online',
                    `${proxyName}: Online (uptime: ${formatUptime(data.uptime)})`);

                // Emit event if status changed
                if (wasOffline && window.AppEvents) {
                    AppEvents.emit('connection:proxy:online', {
                        proxy: proxyName,
                        uptime: data.uptime
                    });
                }
                return true;
            }
        } catch (error) {
            // Proxy is offline or unreachable
        }

        const wasOnline = connectionStatus[proxyName].online;
        connectionStatus[proxyName] = {
            online: false,
            lastCheck: new Date(),
            uptime: null
        };
        updateIndicator(`status-${proxyName}`, 'offline',
            `${proxyName}: Offline - run 'npm start' to start proxies`);

        // Emit event if status changed
        if (wasOnline && window.AppEvents) {
            AppEvents.emit('connection:proxy:offline', { proxy: proxyName });
        }
        return false;
    }

    /**
     * Check all connections (Hue bridge + proxies) in parallel
     * Uses guard flag to prevent overlapping checks
     * @returns {Promise<Object>} Results of all health checks
     */
    async function checkAllConnections() {
        // Prevent overlapping connection checks
        if (isCheckingConnections) {
            Logger.warn('Connection check already in progress, skipping...');
            return connectionStatus;
        }

        isCheckingConnections = true;
        try {
            await Promise.all([
                checkHueBridgeHealth(),
                checkProxyHealth('sonos', APP_CONFIG.proxies.sonos),
                checkProxyHealth('tapo', APP_CONFIG.proxies.tapo),
                checkProxyHealth('shield', APP_CONFIG.proxies.shield)
            ]);
        } finally {
            isCheckingConnections = false;
        }

        return connectionStatus;
    }

    /**
     * Check if a specific service is online
     * @param {string} service - Service name (hue, sonos, tapo, shield)
     * @returns {boolean} True if service is online
     */
    function isOnline(service) {
        return connectionStatus[service]?.online || false;
    }

    /**
     * Get the current connection status for all services
     * @returns {Object} Connection status object
     */
    function getStatus() {
        return { ...connectionStatus };
    }

    // =============================================================================
    // EXPOSE MODULE
    // =============================================================================

    window.ConnectionMonitor = {
        checkAll: checkAllConnections,
        checkHue: checkHueBridgeHealth,
        checkProxy: checkProxyHealth,
        isOnline,
        getStatus,
        formatUptime
    };

    // Legacy alias for backwards compatibility
    window.checkAllConnections = checkAllConnections;

})();
