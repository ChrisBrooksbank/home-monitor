/**
 * Barrel export for proxy server modules
 *
 * Note: These are standalone proxy servers that run independently.
 * This file exports their utilities and types for potential reuse.
 */

// Middleware utilities (legacy - kept for compatibility)
export {
    parseJsonBody,
    sendJson,
    sendError,
    setCorsHeaders,
    handlePreflight,
    getHealthStatus,
    logRequest,
} from './middleware.js';

export type { HealthStatus } from './middleware.js';

// Sonos proxy exports
export {
    probeSonos,
    scanForSpeakers,
    discoverSpeakers,
    getSpeakerIP,
    discoveredSpeakers,
    lastDiscovery as sonosLastDiscovery,
    _setDiscoveredSpeakers,
    _resetDiscoveredSpeakers,
    app as sonosApp,
} from './sonos-proxy.js';

export type { SonosSpeaker, SpeakerMap, ProbeResult as SonosProbeResult } from './sonos-proxy.js';

// Tapo proxy exports
export {
    probeTapo,
    scanForPlugs,
    getPlugInfo,
    discoverAndIdentifyPlugs,
    getPlugIP,
    discoveredPlugs,
    MANUAL_PLUGS,
    REDISCOVERY_INTERVAL,
    _setDiscoveredPlugs,
    _resetDiscoveredPlugs,
    app as tapoApp,
} from './tapo-proxy.js';

export type {
    TapoPlug,
    PlugMap,
    ProbeResult as TapoProbeResult,
    PlugInfo,
    PlugNameRequest,
} from './tapo-proxy.js';

// Shield proxy exports
export { app as shieldApp } from './shield-proxy.js';

export type {
    LaunchResult,
    StopResult,
    DeviceInfo,
} from '../../scripts/control/shield-control.js';

export type { ShieldControl } from './shield-proxy.js';

// News proxy exports
export {
    parseRSS,
    fetchRSS,
    getHeadlines,
    getRandomHeadline,
    refreshHeadlines,
    cachedHeadlines,
    lastFetchTime as newsLastFetchTime,
    CACHE_DURATION,
    _resetCache,
    _setCache,
    app as newsApp,
} from './news-proxy.js';

export type { Headline } from './news-proxy.js';
