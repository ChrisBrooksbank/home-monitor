/**
 * Configuration Schema
 * Zod validation schema for home.config.json
 */

import { z } from 'zod';

// =============================================================================
// LOCATION SCHEMA
// =============================================================================

const CoordinatesSchema = z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
});

const LocationSchema = z.object({
    name: z.string().min(1),
    coordinates: CoordinatesSchema,
    postcode: z.string().optional(),
});

// =============================================================================
// PROXY SCHEMA
// =============================================================================

const ProxyEndpointSchema = z.object({
    host: z.string().min(1).default('localhost'),
    port: z.number().int().positive().max(65535),
});

const ProxiesSchema = z.object({
    sonos: ProxyEndpointSchema,
    tapo: ProxyEndpointSchema,
    shield: ProxyEndpointSchema,
    nest: ProxyEndpointSchema,
    news: ProxyEndpointSchema,
});

// =============================================================================
// INTERVALS SCHEMA
// =============================================================================

const IntervalsSchema = z.object({
    motionSensors: z.number().int().positive(),
    lights: z.number().int().positive(),
    sensorDetails: z.number().int().positive(),
    temperatures: z.number().int().positive(),
    motionLog: z.number().int().positive(),
    sky: z.number().int().positive(),
    sunTimes: z.number().int().positive(),
    weather: z.number().int().positive(),
    nest: z.number().int().positive(),
    sonosVolume: z.number().int().positive(),
    tapoStatus: z.number().int().positive(),
    connectionStatus: z.number().int().positive(),
});

// =============================================================================
// TIMEOUTS & RETRY SCHEMA
// =============================================================================

const TimeoutsSchema = z.object({
    proxyCheck: z.number().int().positive(),
    apiRequest: z.number().int().positive(),
});

const RetrySchema = z.object({
    maxAttempts: z.number().int().positive(),
    initialDelay: z.number().int().positive(),
    maxDelay: z.number().int().positive(),
    backoffMultiplier: z.number().positive(),
});

const HistorySchema = z.object({
    motionRetentionHours: z.number().int().positive(),
    temperatureRetentionHours: z.number().int().positive(),
});

// =============================================================================
// SERVICES SCHEMA
// =============================================================================

const HueServiceSchema = z
    .object({
        bridgeIp: z.string().min(1),
        username: z.string().min(1),
    })
    .nullable()
    .optional();

const WeatherServiceSchema = z
    .object({
        apiKey: z.string().min(10),
    })
    .nullable()
    .optional();

const NestTokensSchema = z
    .object({
        accessToken: z.string().min(1),
        refreshToken: z.string().min(1),
        expiresAt: z.number().int().positive(),
    })
    .nullable()
    .optional();

const NestServiceSchema = z
    .object({
        clientId: z.string().min(1),
        clientSecret: z.string().min(1),
        projectId: z.string().min(1),
        tokens: NestTokensSchema,
    })
    .nullable()
    .optional();

const ServicesSchema = z.object({
    hue: HueServiceSchema,
    weather: WeatherServiceSchema,
    nest: NestServiceSchema,
});

// =============================================================================
// ROOMS & MAPPINGS SCHEMA
// =============================================================================

const RoomsSchema = z.array(z.string()).optional();

const SensorMappingsSchema = z.record(z.string(), z.string()).optional();

// =============================================================================
// DEVICES SCHEMA
// =============================================================================

const HubDeviceSchema = z
    .object({
        ip: z.string().min(1),
        port: z.number().int().positive().default(8008),
    })
    .optional();

const DevicesSchema = z
    .object({
        hub: HubDeviceSchema,
    })
    .optional();

// =============================================================================
// MAIN CONFIG SCHEMA
// =============================================================================

export const HomeConfigSchema = z.object({
    $comment: z.string().optional(),
    location: LocationSchema,
    proxies: ProxiesSchema,
    intervals: IntervalsSchema,
    timeouts: TimeoutsSchema,
    retry: RetrySchema,
    history: HistorySchema,
    services: ServicesSchema,
    rooms: RoomsSchema,
    sensorToRoom: SensorMappingsSchema,
    lightPatterns: SensorMappingsSchema,
    motionPatterns: SensorMappingsSchema,
    devices: DevicesSchema,
    debug: z.boolean().default(false),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type HomeConfig = z.infer<typeof HomeConfigSchema>;
export type LocationConfig = z.infer<typeof LocationSchema>;
export type ProxyEndpoint = z.infer<typeof ProxyEndpointSchema>;
export type ProxiesConfig = z.infer<typeof ProxiesSchema>;
export type IntervalsConfig = z.infer<typeof IntervalsSchema>;
export type TimeoutsConfig = z.infer<typeof TimeoutsSchema>;
export type RetryConfig = z.infer<typeof RetrySchema>;
export type HistoryConfig = z.infer<typeof HistorySchema>;
export type HueServiceConfig = z.infer<typeof HueServiceSchema>;
export type WeatherServiceConfig = z.infer<typeof WeatherServiceSchema>;
export type NestServiceConfig = z.infer<typeof NestServiceSchema>;
export type NestTokens = z.infer<typeof NestTokensSchema>;
export type ServicesConfig = z.infer<typeof ServicesSchema>;
export type HubDeviceConfig = z.infer<typeof HubDeviceSchema>;
export type DevicesConfig = z.infer<typeof DevicesSchema>;

// =============================================================================
// VALIDATION ERROR
// =============================================================================

export class ConfigValidationError extends Error {
    constructor(public readonly errors: string[]) {
        super(`Configuration validation failed:\n  ${errors.join('\n  ')}`);
        this.name = 'ConfigValidationError';
    }
}
