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
     * Update a status indicator LED on the wheelie bin
     * @param {string} id - Element ID (e.g., 'status-hue')
     * @param {string} state - 'checking', 'online', or 'offline'
     * @param {string} [title] - Optional tooltip text
     */
    function updateIndicator(id, state, title) {
        // Extract service name from id (e.g., 'status-hue' -> 'hue')
        const service = id.replace('status-', '');
        const led = document.getElementById(`bin-led-${service}`);

        if (!led) return;

        // Update LED color based on state
        const colors = {
            online: '#5D8A4A',    // Green
            offline: '#C45C3E',   // Red
            checking: '#E6A23C'   // Amber
        };

        led.setAttribute('fill', colors[state] || '#999');

        // Update tooltip
        const titleEl = led.querySelector('title');
        if (titleEl && title) {
            titleEl.textContent = title;
        }

        // Add glow effect for online status
        if (state === 'online') {
            led.setAttribute('filter', 'url(#glow)');
        } else {
            led.removeAttribute('filter');
        }
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

    /**
     * Wait for all connections to come online with rapid retries
     * Used during startup when proxies may still be initializing
     * @param {Object} options - Configuration options
     * @param {number} [options.maxAttempts=10] - Maximum retry attempts
     * @param {number} [options.retryInterval=2000] - Milliseconds between retries
     * @param {number} [options.timeout=30000] - Total timeout in milliseconds
     * @returns {Promise<Object>} Final connection status
     */
    async function waitForConnections(options = {}) {
        const maxAttempts = options.maxAttempts || 10;
        const retryInterval = options.retryInterval || 2000;
        const timeout = options.timeout || 30000;
        const startTime = Date.now();

        Logger.info('Waiting for services to come online...');

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            // Check if we've exceeded timeout
            if (Date.now() - startTime > timeout) {
                Logger.warn(`Connection wait timed out after ${timeout}ms`);
                break;
            }

            await checkAllConnections();

            // Check if all services are online
            const allOnline = Object.values(connectionStatus).every(s => s.online);
            const onlineCount = Object.values(connectionStatus).filter(s => s.online).length;
            const totalCount = Object.keys(connectionStatus).length;

            Logger.info(`Connection check ${attempt}/${maxAttempts}: ${onlineCount}/${totalCount} services online`);

            if (allOnline) {
                Logger.success('All services are online!');
                return connectionStatus;
            }

            // Wait before next attempt (unless this was the last attempt)
            if (attempt < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, retryInterval));
            }
        }

        // Log which services are still offline
        const offline = Object.entries(connectionStatus)
            .filter(([_, status]) => !status.online)
            .map(([name, _]) => name);

        if (offline.length > 0) {
            Logger.warn(`Services still offline: ${offline.join(', ')}`);
        }

        return connectionStatus;
    }

    // =============================================================================
    // EXPOSE MODULE
    // =============================================================================

    window.ConnectionMonitor = {
        checkAll: checkAllConnections,
        checkHue: checkHueBridgeHealth,
        checkProxy: checkProxyHealth,
        waitForConnections,
        isOnline,
        getStatus,
        formatUptime
    };

    // Legacy alias for backwards compatibility
    window.checkAllConnections = checkAllConnections;

})();
