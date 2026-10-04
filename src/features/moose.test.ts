/**
 * Unit tests for moose.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './moose';
import { Registry } from '../core/registry';

describe('MooseSystem.show', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '<svg><g id="sun"></g><g id="moose-container"></g></svg>';
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should position the moose on a wrapper so CSS animations do not override it', () => {
        const moose = Registry.get('MooseSystem') as { show: () => void };
        moose.show();

        const positioner = document.getElementById('active-moose');
        expect(positioner?.getAttribute('transform')).toMatch(/^translate\(\d+, \d+\)$/);
        // The walk-in animation (a CSS transform) goes on the inner group, never on
        // the element whose transform attribute positions the moose
        expect(positioner?.style.animation ?? '').toBe('');
        const body = positioner?.firstElementChild as SVGGElement | null;
        expect(body?.style.animation).toContain('moose-walk-in');
    });
});
