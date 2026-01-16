/**
 * Configuration Schemas
 * Zod validation schemas for external configuration
 */

import { z } from 'zod';

// =============================================================================
// HUE CONFIG SCHEMA
// =============================================================================

export const HueConfigSchema = z.object({
    BRIDGE_IP: z.string().min(1, 'Bridge IP is required'),
    USERNAME: z.string().min(1, 'API username is required'),
    IFTTT: z
        .object({
            enabled: z.boolean(),
            webhookKey: z.string(),
            events: z.record(z.string(), z.string()),
        })
        .optional(),
});

// =============================================================================
// WEATHER CONFIG SCHEMA
// =============================================================================

export const WeatherConfigSchema = z.object({
    API_KEY: z.string().min(1, 'Weather API key is required'),
    LOCATION: z.string().optional(),
    UPDATE_INTERVAL: z.number().positive().optional(),
});

// =============================================================================
// NEST CONFIG SCHEMA
// =============================================================================

export const NestConfigSchema = z.object({
    CLIENT_ID: z.string().min(1, 'Client ID is required'),
    CLIENT_SECRET: z.string().min(1, 'Client secret is required'),
    PROJECT_ID: z.string().min(1, 'Project ID is required'),
    REDIRECT_URI: z.string().optional(),
    ACCESS_TOKEN: z.string().optional(),
    REFRESH_TOKEN: z.string().optional(),
    EXPIRES_AT: z.number().optional(),
});

// Raw Nest config schema (accepts both casing conventions)
export const NestConfigRawSchema = z
    .object({
        CLIENT_ID: z.string().min(1),
        CLIENT_SECRET: z.string().min(1),
        PROJECT_ID: z.string().min(1),
        REDIRECT_URI: z.string().optional(),
        // Support both casing conventions
        ACCESS_TOKEN: z.string().optional(),
        access_token: z.string().optional(),
        REFRESH_TOKEN: z.string().optional(),
        refresh_token: z.string().optional(),
        EXPIRES_AT: z.number().optional(),
        expires_at: z.number().optional(),
    })
    .passthrough();

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type HueConfigValidated = z.infer<typeof HueConfigSchema>;
export type WeatherConfigValidated = z.infer<typeof WeatherConfigSchema>;
export type NestConfigValidated = z.infer<typeof NestConfigSchema>;
export type NestConfigRaw = z.infer<typeof NestConfigRawSchema>;

// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

export interface ValidationResult<T> {
    success: boolean;
    data?: T;
    errors?: string[];
}

/**
 * Validate configuration and return detailed result
 */
export function validateConfig<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    configName: string
): ValidationResult<T> {
    const result = schema.safeParse(data);

    if (result.success) {
        return { success: true, data: result.data };
    }

    const errors = result.error.errors.map(e => `${configName}.${e.path.join('.')}: ${e.message}`);

    return { success: false, errors };
}
