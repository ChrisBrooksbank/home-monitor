/**
 * Unit tests for config schema validation
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { validateConfig } from './schemas';

describe('validateConfig', () => {
    const schema = z.object({ BRIDGE_IP: z.string(), USERNAME: z.string() });

    it('should return data for valid config', () => {
        const result = validateConfig(
            schema,
            { BRIDGE_IP: '1.2.3.4', USERNAME: 'u' },
            'HUE_CONFIG'
        );

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ BRIDGE_IP: '1.2.3.4', USERNAME: 'u' });
    });

    it('should return prefixed error messages for invalid config', () => {
        const result = validateConfig(schema, { BRIDGE_IP: 42 }, 'HUE_CONFIG');

        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(2);
        expect(result.errors?.[0]).toMatch(/^HUE_CONFIG\.BRIDGE_IP: /);
        expect(result.errors?.[1]).toMatch(/^HUE_CONFIG\.USERNAME: /);
    });
});
