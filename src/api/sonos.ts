/**
 * Sonos API Module
 * Handles communication with Sonos speakers via proxy
 */

import type {
  SonosCommand,
  SonosSpeakersResponse,
  SonosDiscoveryResponse,
  SoapResponse,
} from '../types';
import { Logger } from '../utils/logger';
import { retryWithBackoff } from '../utils/helpers';
import { Registry } from '../core/registry';

// Helper to get APP_CONFIG
function getAppConfig() {
  return Registry.getOptional('APP_CONFIG');
}

type CommandName = 'Play' | 'Pause' | 'GetVolume' | 'SetVolume';

// SOAP command templates
const commands: Record<CommandName, SonosCommand> = {
  Play: {
    service: 'AVTransport',
    path: '/MediaRenderer/AVTransport/Control',
    params: { InstanceID: 0, Speed: 1 },
  },
  Pause: {
    service: 'AVTransport',
    path: '/MediaRenderer/AVTransport/Control',
    params: { InstanceID: 0 },
  },
  GetVolume: {
    service: 'RenderingControl',
    path: '/MediaRenderer/RenderingControl/Control',
    params: { InstanceID: 0, Channel: 'Master' },
  },
  SetVolume: {
    service: 'RenderingControl',
    path: '/MediaRenderer/RenderingControl/Control',
    params: { InstanceID: 0, Channel: 'Master', DesiredVolume: null },
  },
};

/**
 * Build SOAP XML from template
 */
function buildSoapXml(
  action: string,
  service: 'AVTransport' | 'RenderingControl',
  params: Record<string, string | number | null>
): string {
  const xmlns =
    service === 'AVTransport'
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
}

/**
 * Send SOAP request to Sonos device via proxy
 */
async function soapRequest(
  ip: string,
  path: string,
  soapAction: string,
  soapBody: string
): Promise<SoapResponse> {
  const config = getAppConfig();
  try {
    const proxyUrl = `${config?.proxies?.sonos ?? 'http://localhost:3000'}${path}`;

    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="utf-8"',
        SOAPAction: soapAction,
        'X-Sonos-IP': ip,
      },
      body: soapBody,
      signal: AbortSignal.timeout(config?.timeouts?.apiRequest ?? 10000),
    });

    const text = await response.text();
    return { ok: response.ok, status: response.status, body: text };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error('Sonos SOAP request failed:', message);
    return { ok: false, error: message };
  }
}

/**
 * Execute a Sonos command
 */
async function command(
  ip: string,
  commandName: CommandName,
  extraParams: Record<string, string | number | null> = {}
): Promise<SoapResponse> {
  const template = commands[commandName];
  if (!template) {
    Logger.error(`Unknown Sonos command: ${commandName}`);
    return { ok: false, error: 'Unknown command' };
  }

  const params = { ...template.params, ...extraParams };
  const soapBody = buildSoapXml(commandName, template.service, params);
  const soapAction = `"urn:schemas-upnp-org:service:${template.service}:1#${commandName}"`;

  return await retryWithBackoff(() =>
    soapRequest(ip, template.path, soapAction, soapBody)
  );
}

/**
 * Play audio on Sonos speaker
 */
async function play(ip: string): Promise<boolean> {
  Logger.info(`Playing on Sonos speaker ${ip}`);
  const result = await command(ip, 'Play');
  return result.ok;
}

/**
 * Pause audio on Sonos speaker
 */
async function pause(ip: string): Promise<boolean> {
  Logger.info(`Pausing Sonos speaker ${ip}`);
  const result = await command(ip, 'Pause');
  return result.ok;
}

/**
 * Get current volume
 */
async function getVolume(ip: string): Promise<number> {
  const result = await command(ip, 'GetVolume');
  if (result.ok && result.body) {
    const match = result.body.match(/<CurrentVolume>(\d+)<\/CurrentVolume>/);
    return match ? parseInt(match[1], 10) : 0;
  }
  return 0;
}

/**
 * Set volume
 */
async function setVolume(ip: string, volume: number): Promise<boolean> {
  Logger.info(`Setting Sonos ${ip} volume to ${volume}`);
  const result = await command(ip, 'SetVolume', { DesiredVolume: volume });
  return result.ok;
}

/**
 * Change volume by delta
 */
async function changeVolume(ip: string, delta: number): Promise<boolean> {
  const currentVolume = await getVolume(ip);
  const newVolume = Math.max(0, Math.min(100, currentVolume + delta));
  return await setVolume(ip, newVolume);
}

/**
 * Get list of discovered speakers
 */
async function getSpeakers(): Promise<SonosSpeakersResponse> {
  const config = getAppConfig();
  try {
    const response = await fetch(`${config?.proxies?.sonos ?? 'http://localhost:3000'}/speakers`, {
      method: 'GET',
      signal: AbortSignal.timeout(config?.timeouts?.proxyCheck ?? 2000),
    });
    return (await response.json()) as SonosSpeakersResponse;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error('Failed to get Sonos speakers:', message);
    return { speakers: {}, lastDiscovery: null, count: 0 };
  }
}

/**
 * Trigger network discovery for Sonos speakers
 */
async function discover(): Promise<SonosDiscoveryResponse> {
  const config = getAppConfig();
  Logger.info('Starting Sonos speaker discovery...');
  try {
    const response = await fetch(`${config?.proxies?.sonos ?? 'http://localhost:3000'}/discover`, {
      method: 'POST',
      signal: AbortSignal.timeout(60000),
    });
    const result = (await response.json()) as SonosDiscoveryResponse;
    if (result.success) {
      Logger.success(`Discovered ${result.count} Sonos speakers`);
    }
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error('Discovery failed:', message);
    throw error;
  }
}

/**
 * Check if Sonos proxy is available
 */
async function checkAvailability(): Promise<boolean> {
  const config = getAppConfig();
  try {
    const response = await fetch(`${config?.proxies?.sonos ?? 'http://localhost:3000'}/speakers`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(config?.timeouts?.proxyCheck ?? 2000),
    });
    if (response.ok) {
      Logger.success('Sonos proxy is available');
      return true;
    }
    Logger.warn('Sonos proxy not available - controls will be disabled');
    return false;
  } catch {
    Logger.warn('Sonos proxy not available - controls will be disabled');
    return false;
  }
}

export const SonosAPI = {
  get proxyUrl() {
    return getAppConfig()?.proxies?.sonos ?? 'http://localhost:3000';
  },
  commands,
  buildSoapXml,
  soapRequest,
  command,
  play,
  pause,
  getVolume,
  setVolume,
  changeVolume,
  getSpeakers,
  discover,
  checkAvailability,
} as const;

// Register with the service registry
Registry.register({
  key: 'SonosAPI',
  instance: SonosAPI,
});
