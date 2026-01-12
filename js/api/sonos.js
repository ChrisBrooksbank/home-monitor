// Sonos API Module
const SonosAPI = {
    proxyUrl: APP_CONFIG.proxies.sonos,
    sonosPort: 1400,

    // SOAP command templates
    commands: {
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
    },

    /**
     * Build SOAP XML from template
     */
    buildSoapXml(action, service, params) {
        const xmlns = service === 'AVTransport'
            ? 'urn:schemas-upnp-org:service:AVTransport:1'
            : 'urn:schemas-upnp-org:service:RenderingControl:1';

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
    },

    /**
     * Send SOAP request to Sonos device via proxy
     */
    async soapRequest(ip, path, soapAction, soapBody) {
        try {
            const proxyUrl = `${this.proxyUrl}${path}`;

            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/xml; charset="utf-8"',
                    'SOAPAction': soapAction,
                    'X-Sonos-IP': ip
                },
                body: soapBody,
                signal: AbortSignal.timeout(APP_CONFIG.timeouts.apiRequest)
            });

            const text = await response.text();
            return { ok: response.ok, status: response.status, body: text };
        } catch (error) {
            Logger.error('Sonos SOAP request failed:', error.message);
            return { ok: false, error: error.message };
        }
    },

    /**
     * Execute a Sonos command
     */
    async command(ip, commandName, extraParams = {}) {
        const template = this.commands[commandName];
        if (!template) {
            Logger.error(`Unknown Sonos command: ${commandName}`);
            return { ok: false, error: 'Unknown command' };
        }

        const params = { ...template.params, ...extraParams };
        const soapBody = this.buildSoapXml(commandName, template.service, params);
        const soapAction = `"urn:schemas-upnp-org:service:${template.service}:1#${commandName}"`;

        return await retryWithBackoff(() =>
            this.soapRequest(ip, template.path, soapAction, soapBody)
        );
    },

    /**
     * Play audio on Sonos speaker
     */
    async play(ip) {
        Logger.info(`Playing on Sonos speaker ${ip}`);
        const result = await this.command(ip, 'Play');
        return result.ok;
    },

    /**
     * Pause audio on Sonos speaker
     */
    async pause(ip) {
        Logger.info(`Pausing Sonos speaker ${ip}`);
        const result = await this.command(ip, 'Pause');
        return result.ok;
    },

    /**
     * Get current volume
     */
    async getVolume(ip) {
        const result = await this.command(ip, 'GetVolume');
        if (result.ok) {
            const match = result.body.match(/<CurrentVolume>(\d+)<\/CurrentVolume>/);
            return match ? parseInt(match[1]) : 0;
        }
        return 0;
    },

    /**
     * Set volume
     */
    async setVolume(ip, volume) {
        Logger.info(`Setting Sonos ${ip} volume to ${volume}`);
        const result = await this.command(ip, 'SetVolume', { DesiredVolume: volume });
        return result.ok;
    },

    /**
     * Change volume by delta
     */
    async changeVolume(ip, delta) {
        const currentVolume = await this.getVolume(ip);
        const newVolume = Math.max(0, Math.min(100, currentVolume + delta));
        return await this.setVolume(ip, newVolume);
    },

    /**
     * Get list of discovered speakers
     */
    async getSpeakers() {
        try {
            const response = await fetch(`${this.proxyUrl}/speakers`, {
                method: 'GET',
                signal: AbortSignal.timeout(APP_CONFIG.timeouts.proxyCheck)
            });
            return await response.json();
        } catch (error) {
            Logger.error('Failed to get Sonos speakers:', error.message);
            return { speakers: {}, count: 0 };
        }
    },

    /**
     * Trigger network discovery for Sonos speakers
     */
    async discover() {
        Logger.info('Starting Sonos speaker discovery...');
        try {
            const response = await fetch(`${this.proxyUrl}/discover`, {
                method: 'POST',
                signal: AbortSignal.timeout(60000)
            });
            const result = await response.json();
            if (result.success) {
                Logger.success(`Discovered ${result.count} Sonos speakers`);
            }
            return result;
        } catch (error) {
            Logger.error('Discovery failed:', error.message);
            throw error;
        }
    },

    /**
     * Check if Sonos proxy is available
     */
    async checkAvailability() {
        return await checkProxyAvailability(
            `${this.proxyUrl}/speakers`,
            'Sonos'
        );
    }
};

// Expose on window for global access
if (typeof window !== 'undefined') {
    window.SonosAPI = SonosAPI;
}

// Export for ES modules (Vitest)
export { SonosAPI };
