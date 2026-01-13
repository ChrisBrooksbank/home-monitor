/**
 * Motion Indicators Module
 * Shows animated monkey face when motion is detected in monitored areas
 *
 * Subscribes to AppEvents 'motion:detected' for automatic display.
 */

import { Logger } from '../utils/logger';
import { AppEvents } from '../core';
import type { MotionDetectedEvent, RoomPosition } from '../types';

// Declare global types
declare global {
  interface Window {
    MotionIndicators?: typeof MotionIndicators;
  }
}

const NS = 'http://www.w3.org/2000/svg';

// Position mappings for motion indicators
const MOTION_POSITIONS: Record<string, RoomPosition> = {
  Outdoor: { x: 155, y: 100, isOutdoor: true },
  Hall: { x: 200, y: 420 },
  Landing: { x: 340, y: 250 },
  Bathroom: { x: 660, y: 250 },
};

// Track active indicators to prevent duplicates
const activeIndicators = new Set<string>();

/**
 * Create a monkey face SVG element
 */
function createMonkeyFace(): SVGGElement {
  const monkeyGroup = document.createElementNS(NS, 'g');
  monkeyGroup.setAttribute('class', 'monkey-shake');

  // Monkey head (brown circle)
  const head = document.createElementNS(NS, 'circle');
  head.setAttribute('cx', '0');
  head.setAttribute('cy', '0');
  head.setAttribute('r', '18');
  head.setAttribute('fill', '#8B4513');
  head.setAttribute('stroke', '#5D2E0F');
  head.setAttribute('stroke-width', '2');
  monkeyGroup.appendChild(head);

  // Face area (lighter brown)
  const face = document.createElementNS(NS, 'ellipse');
  face.setAttribute('cx', '0');
  face.setAttribute('cy', '3');
  face.setAttribute('rx', '12');
  face.setAttribute('ry', '10');
  face.setAttribute('fill', '#D2691E');
  monkeyGroup.appendChild(face);

  // Left ear
  const leftEar = document.createElementNS(NS, 'circle');
  leftEar.setAttribute('cx', '-15');
  leftEar.setAttribute('cy', '-8');
  leftEar.setAttribute('r', '6');
  leftEar.setAttribute('fill', '#8B4513');
  leftEar.setAttribute('stroke', '#5D2E0F');
  leftEar.setAttribute('stroke-width', '1.5');
  monkeyGroup.appendChild(leftEar);

  // Right ear
  const rightEar = document.createElementNS(NS, 'circle');
  rightEar.setAttribute('cx', '15');
  rightEar.setAttribute('cy', '-8');
  rightEar.setAttribute('r', '6');
  rightEar.setAttribute('fill', '#8B4513');
  rightEar.setAttribute('stroke', '#5D2E0F');
  rightEar.setAttribute('stroke-width', '1.5');
  monkeyGroup.appendChild(rightEar);

  // Left eye
  const leftEye = document.createElementNS(NS, 'circle');
  leftEye.setAttribute('cx', '-6');
  leftEye.setAttribute('cy', '-2');
  leftEye.setAttribute('r', '3');
  leftEye.setAttribute('fill', 'white');
  monkeyGroup.appendChild(leftEye);

  const leftPupil = document.createElementNS(NS, 'circle');
  leftPupil.setAttribute('cx', '-5');
  leftPupil.setAttribute('cy', '-1');
  leftPupil.setAttribute('r', '2');
  leftPupil.setAttribute('fill', 'black');
  monkeyGroup.appendChild(leftPupil);

  // Right eye
  const rightEye = document.createElementNS(NS, 'circle');
  rightEye.setAttribute('cx', '6');
  rightEye.setAttribute('cy', '-2');
  rightEye.setAttribute('r', '3');
  rightEye.setAttribute('fill', 'white');
  monkeyGroup.appendChild(rightEye);

  const rightPupil = document.createElementNS(NS, 'circle');
  rightPupil.setAttribute('cx', '7');
  rightPupil.setAttribute('cy', '-1');
  rightPupil.setAttribute('r', '2');
  rightPupil.setAttribute('fill', 'black');
  monkeyGroup.appendChild(rightPupil);

  // Nose
  const nose = document.createElementNS(NS, 'ellipse');
  nose.setAttribute('cx', '0');
  nose.setAttribute('cy', '5');
  nose.setAttribute('rx', '3');
  nose.setAttribute('ry', '2');
  nose.setAttribute('fill', '#5D2E0F');
  monkeyGroup.appendChild(nose);

  // Mouth (smile)
  const mouth = document.createElementNS(NS, 'path');
  mouth.setAttribute('d', 'M -5 8 Q 0 12 5 8');
  mouth.setAttribute('stroke', '#5D2E0F');
  mouth.setAttribute('stroke-width', '1.5');
  mouth.setAttribute('fill', 'none');
  mouth.setAttribute('stroke-linecap', 'round');
  monkeyGroup.appendChild(mouth);

  return monkeyGroup;
}

/**
 * Create a pulsing circle animation
 */
function createPulseCircle(): SVGCircleElement {
  const circle = document.createElementNS(NS, 'circle');
  circle.setAttribute('cx', '0');
  circle.setAttribute('cy', '0');
  circle.setAttribute('r', '25');
  circle.setAttribute('fill', 'none');
  circle.setAttribute('stroke', '#FF6B6B');
  circle.setAttribute('stroke-width', '2');
  circle.setAttribute('opacity', '0.6');
  (circle as SVGCircleElement & { style: CSSStyleDeclaration }).style.animation =
    'pulse 1.5s ease-out infinite';
  return circle;
}

/**
 * Show motion indicator for a room
 */
function showMotionIndicator(room: string): void {
  // Don't show duplicate indicators
  if (activeIndicators.has(room)) return;

  const pos = MOTION_POSITIONS[room];
  if (!pos) return;

  const container = document.getElementById('motion-indicators-container');
  if (!container) return;

  activeIndicators.add(room);

  // Create motion indicator group
  const group = document.createElementNS(NS, 'g');
  group.setAttribute('class', 'motion-indicator');
  group.setAttribute('data-room', room);
  group.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);

  // Add pulse circle behind monkey
  const pulse = createPulseCircle();
  group.appendChild(pulse);

  // Add monkey face
  const monkey = createMonkeyFace();
  group.appendChild(monkey);

  container.appendChild(group);

  // Schedule fade-out after 30 seconds
  setTimeout(() => {
    monkey.setAttribute('class', 'monkey-shake monkey-fadeout');
    setTimeout(() => {
      group.remove();
      activeIndicators.delete(room);
    }, 2000);
  }, 30000);

  Logger.info(`Motion indicator shown for ${room}`);
}

/**
 * Clear all motion indicators
 */
function clearAllIndicators(): void {
  const container = document.getElementById('motion-indicators-container');
  if (container) {
    container.innerHTML = '';
  }
  activeIndicators.clear();
}

/**
 * Motion sensor state interface
 */
interface MotionSensorState {
  detected: boolean;
  lastUpdated?: Date | null;
}

/**
 * Update motion indicators based on sensor states
 * Called by app.js when motion is detected
 */
function updateIndicators(motionSensors: Record<string, MotionSensorState>): void {
  for (const [room, motion] of Object.entries(motionSensors)) {
    if (motion.detected && !activeIndicators.has(room)) {
      showMotionIndicator(room);
    }
  }
}

/**
 * Initialize module and subscribe to events
 */
function init(): void {
  // Subscribe to motion events - this decouples us from app.js
  if (AppEvents) {
    AppEvents.on('motion:detected', (data: MotionDetectedEvent) => {
      showMotionIndicator(data.room);
    });
    Logger.info('Motion indicators subscribed to motion:detected events');
  }
}

/**
 * Motion Indicators module export
 */
export const MotionIndicators = {
  init,
  show: showMotionIndicator,
  clear: clearAllIndicators,
  update: updateIndicators,
};

// Expose to window (show/clear kept for backwards compatibility)
if (typeof window !== 'undefined') {
  window.MotionIndicators = MotionIndicators;
}

// Auto-initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

Logger.info('Motion indicators module loaded');
