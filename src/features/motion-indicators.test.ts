/**
 * Unit tests for motion-indicators.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
// Imported before core/events on purpose: the module initialises on import,
// and must still subscribe to motion events (regression test)
import './motion-indicators';
import { AppEvents } from '../core/events';

describe('MotionIndicators', () => {
    beforeEach(() => {
        document.body.innerHTML = '<svg><g id="motion-indicators-container"></g></svg>';
    });

    it('should show an indicator when motion:detected is emitted', () => {
        AppEvents.emit('motion:detected', {
            room: 'Hall',
            sensorId: '1',
            sensorName: 'Hall',
            timestamp: 0,
        });

        const indicator = document.querySelector('#motion-indicators-container .motion-indicator');
        expect(indicator).not.toBeNull();
        expect(indicator?.getAttribute('data-room')).toBe('Hall');
    });
});
