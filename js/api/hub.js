/**
 * Google Home Hub API Module
 * Handles casting and control of Google Home Hub devices
 */

// Hub configuration
const HUB_CONFIG = {
    ip: '192.168.68.62',
    port: 8008
};

/**
 * Google Hub API wrapper
 */
const HubAPI = {
    /**
     * Get base URL for Hub API
     */
    getBaseUrl() {
        return `http://${HUB_CONFIG.ip}:${HUB_CONFIG.port}`;
    },

    /**
     * Get current Hub status
     * @returns {Promise<Object>} - Status object with isPlaying and appName
     */
    async getStatus() {
        try {
            const response = await fetch(`${this.getBaseUrl()}/apps`);
            const text = await response.text();

            try {
                const data = JSON.parse(text);
                if (data.applications && data.applications.length > 0) {
                    return {
                        isPlaying: true,
                        appName: data.applications[0].displayName || 'Active',
                        sessionId: data.applications[0].sessionId
                    };
                }
            } catch (e) {
                // Parse error means idle
            }

            return { isPlaying: false, appName: 'Idle', sessionId: null };
        } catch (error) {
            Logger.error('Error getting Hub status:', error);
            return { isPlaying: false, appName: 'Unavailable', sessionId: null };
        }
    },

    /**
     * Send announcement to Hub using TTS
     * @param {string} message - Message to announce
     * @returns {Promise<boolean>} - Success status
     */
    async announce(message) {
        if (!message) return false;

        try {
            Logger.info(`Announcing to Hub: "${message}"`);

            const encodedMessage = encodeURIComponent(message);
            const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodedMessage}`;

            const response = await fetch(`${this.getBaseUrl()}/apps/CC1AD845`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                Logger.success('Announcement sent');
                return true;
            }
            throw new Error(`HTTP ${response.status}`);
        } catch (error) {
            Logger.error('Hub announce failed:', error);
            return false;
        }
    },

    /**
     * Stop current playback
     * @returns {Promise<boolean>} - Success status
     */
    async stop() {
        try {
            Logger.info('Stopping Hub playback...');

            const status = await this.getStatus();
            if (!status.isPlaying) {
                return true; // Already idle
            }

            const response = await fetch(`${this.getBaseUrl()}/apps/${status.sessionId}`, {
                method: 'DELETE'
            });

            Logger.success('Playback stopped');
            return true;
        } catch (error) {
            Logger.error('Hub stop failed:', error);
            return false;
        }
    },

    /**
     * Cast YouTube video to Hub
     * @param {string} videoId - YouTube video ID or URL
     * @returns {Promise<boolean>} - Success status
     */
    async playYouTube(videoId) {
        if (!videoId) return false;

        try {
            // Extract video ID if full URL was provided
            let id = videoId;
            const urlMatch = videoId.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
            if (urlMatch) {
                id = urlMatch[1];
            }

            Logger.info(`Casting YouTube video ${id} to Hub...`);

            const response = await fetch(`${this.getBaseUrl()}/apps/YouTube`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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
                Logger.success('YouTube video casting');
                return true;
            }
            throw new Error(`HTTP ${response.status}`);
        } catch (error) {
            Logger.error('Hub YouTube cast failed:', error);
            return false;
        }
    },

    /**
     * Display a URL on the Hub
     * @param {string} url - URL to display
     * @returns {Promise<boolean>} - Success status
     */
    async displayUrl(url) {
        try {
            Logger.info(`Displaying URL on Hub: ${url}`);

            const response = await fetch(`${this.getBaseUrl()}/apps/E8C28D3C`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'LOAD',
                    media: {
                        contentId: url,
                        contentType: 'text/html',
                        streamType: 'LIVE'
                    }
                })
            });

            if (response.ok) {
                Logger.success('URL displayed on Hub');
                return true;
            }
            throw new Error(`HTTP ${response.status}`);
        } catch (error) {
            Logger.error('Hub display URL failed:', error);
            return false;
        }
    },

    /**
     * Display current dashboard on Hub
     * @returns {Promise<boolean>} - Success status
     */
    async showDashboard() {
        return await this.displayUrl(window.location.href);
    }
};

// Expose on window for global access
if (typeof window !== 'undefined') {
    window.HubAPI = HubAPI;
    window.HUB_CONFIG = HUB_CONFIG;
}
