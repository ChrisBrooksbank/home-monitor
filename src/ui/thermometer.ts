/**
 * Thermometer UI Module
 * Creates and manages thermometer SVG elements
 */

import type { RoomPosition } from '../types';
import { createDraggable } from './draggable';

const NS = 'http://www.w3.org/2000/svg';

// Room positions for thermometers
const ROOM_POSITIONS: Record<string, RoomPosition> = {
  // First Floor
  'temp-main-bedroom': { x: 180, y: 220 },
  'temp-landing': { x: 340, y: 220 },
  'temp-office': { x: 500, y: 220 },
  'temp-bathroom': { x: 660, y: 220 },
  'temp-guest-bedroom': { x: 820, y: 220 },
  // Ground Floor
  'temp-hall': { x: 200, y: 460 },
  'temp-lounge': { x: 400, y: 460 },
  'temp-kitchen': { x: 600, y: 460 },
  'temp-extension': { x: 800, y: 460 },
  // Outdoor
  'temp-outdoor': { x: 60, y: 10, isOutdoor: true },
};

// Custom thermometer positions (from localStorage)
let customPositions: Record<string, RoomPosition> = {};

/**
 * Initialize custom positions from localStorage
 */
function initCustomPositions(): void {
  const stored = localStorage.getItem('thermometerPositions');
  if (stored) {
    customPositions = JSON.parse(stored) as Record<string, RoomPosition>;
  }
}

/**
 * Get thermometer position (custom or default)
 */
export function getThermometerPosition(elementId: string): RoomPosition | null {
  return customPositions[elementId] ?? ROOM_POSITIONS[elementId] ?? null;
}

/**
 * Get temperature color based on value
 */
export function getTemperatureColor(temp: number): string {
  if (temp < 10) return '#4169E1'; // Royal Blue - Cold
  if (temp < 15) return '#00CED1'; // Dark Turquoise - Cool
  if (temp < 20) return '#32CD32'; // Lime Green - Comfortable
  if (temp < 25) return '#FFA500'; // Orange - Warm
  return '#FF4500'; // Orange Red - Hot
}

/**
 * Create SVG element helper
 */
function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {}
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
}

/**
 * Make thermometer draggable
 */
function makeDraggable(
  group: SVGGElement,
  elementId: string,
  position: RoomPosition
): void {
  createDraggable(group, {
    cursor: 'move',
    customSave: (element) => {
      const transform = element.getAttribute('transform') ?? '';
      const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
      if (match) {
        customPositions[elementId] = {
          x: parseFloat(match[1]),
          y: parseFloat(match[2]),
          isOutdoor: position.isOutdoor,
        };
        localStorage.setItem(
          'thermometerPositions',
          JSON.stringify(customPositions)
        );
      }
    },
  });
}

/**
 * Create thermometer SVG element
 */
export function createThermometer(
  elementId: string,
  temp: number,
  roomName: string
): SVGTextElement | null {
  const position = getThermometerPosition(elementId);
  if (!position) return null;

  const group = createSvgElement('g', {
    class: 'thermometer',
    'data-room': elementId,
  });

  // Thermometer dimensions
  const tubeWidth = 24;
  const tubeHeight = 80;
  const bulbRadius = 16;

  // Background (glass tube)
  group.appendChild(
    createSvgElement('rect', {
      x: 0,
      y: 0,
      width: tubeWidth,
      height: tubeHeight,
      rx: 12,
      fill: 'rgba(255, 255, 255, 0.9)',
      stroke: '#666',
      'stroke-width': 2,
      filter: 'url(#shadow)',
    })
  );

  // Bulb
  group.appendChild(
    createSvgElement('circle', {
      cx: tubeWidth / 2,
      cy: tubeHeight + bulbRadius - 4,
      r: bulbRadius,
      fill: 'rgba(255, 255, 255, 0.9)',
      stroke: '#666',
      'stroke-width': 2,
      filter: 'url(#shadow)',
    })
  );

  // Mercury level (0-30°C range for visualization)
  const tempRange = { min: 0, max: 30 };
  const percentage = Math.max(
    0,
    Math.min(1, (temp - tempRange.min) / (tempRange.max - tempRange.min))
  );
  const mercuryHeight = (tubeHeight - 10) * percentage + bulbRadius * 2 - 4;
  const mercuryColor = position.isOutdoor ? '#00CED1' : getTemperatureColor(temp);

  // Mercury in bulb
  group.appendChild(
    createSvgElement('circle', {
      cx: tubeWidth / 2,
      cy: tubeHeight + bulbRadius - 4,
      r: bulbRadius - 4,
      fill: mercuryColor,
      class: 'mercury-fill',
    })
  );

  // Mercury in tube
  group.appendChild(
    createSvgElement('rect', {
      x: tubeWidth / 2 - 4,
      y: tubeHeight - mercuryHeight + bulbRadius,
      width: 8,
      height: mercuryHeight - bulbRadius,
      rx: 4,
      fill: mercuryColor,
      class: 'mercury-fill',
    })
  );

  // Scale markings
  for (let i = 0; i <= 4; i++) {
    const y = tubeHeight - (tubeHeight - 10) * (i / 4) + 5;
    group.appendChild(
      createSvgElement('line', {
        x1: tubeWidth,
        y1: y,
        x2: tubeWidth + 5,
        y2: y,
        stroke: '#666',
        'stroke-width': 1,
      })
    );
  }

  // Temperature text
  const tempText = createSvgElement('text', {
    x: tubeWidth / 2,
    y: tubeHeight + bulbRadius * 2 + 20,
    'text-anchor': 'middle',
    'font-size': 18,
    'font-weight': 700,
    'font-family': 'Baloo 2',
    fill: 'white',
    stroke: '#333',
    'stroke-width': 3,
    'paint-order': 'stroke fill',
    id: elementId,
  });
  tempText.textContent = temp.toFixed(1) + '°C';
  group.appendChild(tempText);

  // Room label
  const label = createSvgElement('text', {
    x: tubeWidth / 2,
    y: -8,
    'text-anchor': 'middle',
    'font-size': position.isOutdoor ? 12 : 11,
    'font-weight': position.isOutdoor ? 700 : 600,
    'font-family': 'Fredoka',
    fill: position.isOutdoor ? '#0066CC' : '#333',
  });
  label.textContent = roomName;
  group.appendChild(label);

  // Position the thermometer
  group.setAttribute('transform', `translate(${position.x}, ${position.y})`);

  // Add to appropriate container
  const containerId = position.isOutdoor
    ? 'outdoor-thermometer-container'
    : 'thermometers-container';
  const container = document.getElementById(containerId);
  if (container) {
    container.appendChild(group);
  }

  // Make draggable
  makeDraggable(group, elementId, position);

  return tempText;
}

/**
 * Reset all thermometer positions to defaults
 */
export function resetThermometerPositions(): void {
  if (confirm('Reset all thermometer positions to defaults?')) {
    localStorage.removeItem('thermometerPositions');
    customPositions = {};
    location.reload();
  }
}

/**
 * Create sparkle effect around element
 */
export function createSparkles(element: Element | null): void {
  if (!element) return;

  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const sparkleEmojis = ['\u2728', '\u2B50', '\u{1F31F}', '\u{1F4AB}'];
  const numSparkles = 8;

  for (let i = 0; i < numSparkles; i++) {
    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle-star';
    sparkle.textContent = sparkleEmojis[Math.floor(Math.random() * sparkleEmojis.length)];

    const angle = (Math.PI * 2 * i) / numSparkles;
    const distance = 50 + Math.random() * 30;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;

    sparkle.style.left = centerX + 'px';
    sparkle.style.top = centerY + 'px';
    sparkle.style.setProperty('--tx', tx + 'px');
    sparkle.style.setProperty('--ty', ty + 'px');

    document.body.appendChild(sparkle);

    setTimeout(() => sparkle.remove(), 1000);
  }
}

/**
 * Clear all thermometers from containers
 */
export function clearThermometers(): void {
  const indoorContainer = document.getElementById('thermometers-container');
  const outdoorContainer = document.getElementById('outdoor-thermometer-container');

  if (indoorContainer) indoorContainer.innerHTML = '';
  if (outdoorContainer) outdoorContainer.innerHTML = '';
}

// Initialize on load
initCustomPositions();

export { ROOM_POSITIONS };
