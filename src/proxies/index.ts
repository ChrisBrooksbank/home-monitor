/**
 * Barrel export for proxy server modules
 *
 * Note: These are standalone proxy servers that run independently.
 * This file exports their utilities and types for potential reuse.
 */

// Middleware utilities
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
    isAllowedOrigin as isSonosAllowedOrigin,
    discoveredSpeakers,
    lastDiscovery as sonosLastDiscovery,
    _setDiscoveredSpeakers,
    _resetDiscoveredSpeakers,
} from './sonos-proxy.js';

export type { SonosSpeaker, SpeakerMap, ProbeResult as SonosProbeResult } from './sonos-proxy.js';

// Tapo proxy exports
export {
    probeTapo,
    scanForPlugs,
    getPlugInfo,
    discoverAndIdentifyPlugs,
    getPlugIP,
    isAllowedOrigin as isTapoAllowedOrigin,
    discoveredPlugs,
    MANUAL_PLUGS,
    REDISCOVERY_INTERVAL,
    _setDiscoveredPlugs,
    _resetDiscoveredPlugs,
} from './tapo-proxy.js';

export type {
    TapoPlug,
    PlugMap,
    ProbeResult as TapoProbeResult,
    PlugInfo,
    PlugNameRequest,
} from './tapo-proxy.js';

// Shield proxy exports
export { isAllowedOrigin as isShieldAllowedOrigin } from './shield-proxy.js';

export type {
    LaunchResult,
    StopResult,
    DeviceInfo,
} from '../../scripts/control/shield-control.js';

export type { ShieldControl } from './shield-proxy.js';

// News proxy exports
export {
    parseRSS,
    isAllowedOrigin as isNewsAllowedOrigin,
    fetchRSS,
    getHeadlines,
    getRandomHeadline,
    refreshHeadlines,
    cachedHeadlines,
    lastFetchTime as newsLastFetchTime,
    CACHE_DURATION,
    _resetCache,
    _setCache,
} from './news-proxy.js';

export type { Headline } from './news-proxy.js';
