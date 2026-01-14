/**
 * Thermometer UI Module
 * Handles thermometer SVG rendering and sparkle effects
 */

import { roomPositions } from '../../config/mappings';
import { getTemperatureColor } from '../../utils/color-utils';
import { createDraggable, loadSavedPosition } from '../../ui/draggable';

/**
 * Create a pixel-art thermometer SVG element
 */
export function createThermometer(
  elementId: string,
  temp: number,
  _roomName: string
): SVGTextElement | null {
  const position = roomPositions[elementId];
  if (!position) return null;

  const ns = 'http://www.w3.org/2000/svg';
  const group = document.createElementNS(ns, 'g');
  group.setAttribute('class', 'thermometer pixel-thermometer');
  group.setAttribute('data-room', elementId);

  // Compact pixel-art dimensions
  const tubeWidth = 14;
  const tubeHeight = 45;
  const bulbRadius = 9;
  const frameWidth = tubeWidth + 8;
  const totalHeight = tubeHeight + bulbRadius * 2;

  // Colors
  const mercuryColor = position.isOutdoor ? '#3498DB' : getTemperatureColor(temp);
  const frameColor = '#8B7355';
  const frameHighlight = '#A08060';
  const frameShadow = '#5A4A3A';

  // Wooden/brass frame backing
  const frameBg = document.createElementNS(ns, 'rect');
  frameBg.setAttribute('x', '-4');
  frameBg.setAttribute('y', '-6');
  frameBg.setAttribute('width', String(frameWidth));
  frameBg.setAttribute('height', String(totalHeight + 8));
  frameBg.setAttribute('rx', '3');
  frameBg.setAttribute('fill', frameColor);
  frameBg.setAttribute('stroke', frameShadow);
  frameBg.setAttribute('stroke-width', '1.5');
  group.appendChild(frameBg);

  // Frame highlight (left edge)
  const frameHL = document.createElementNS(ns, 'rect');
  frameHL.setAttribute('x', '-3');
  frameHL.setAttribute('y', '-5');
  frameHL.setAttribute('width', '2');
  frameHL.setAttribute('height', String(totalHeight + 6));
  frameHL.setAttribute('rx', '1');
  frameHL.setAttribute('fill', frameHighlight);
  frameHL.setAttribute('opacity', '0.6');
  group.appendChild(frameHL);

  // Glass tube background
  const tube = document.createElementNS(ns, 'rect');
  tube.setAttribute('x', '1');
  tube.setAttribute('y', '0');
  tube.setAttribute('width', String(tubeWidth - 2));
  tube.setAttribute('height', String(tubeHeight));
  tube.setAttribute('rx', '6');
  tube.setAttribute('fill', '#F5F5F0');
  tube.setAttribute('stroke', '#C8C0B0');
  tube.setAttribute('stroke-width', '1');
  group.appendChild(tube);

  // Bulb background
  const bulb = document.createElementNS(ns, 'circle');
  bulb.setAttribute('cx', String(tubeWidth / 2));
  bulb.setAttribute('cy', String(tubeHeight + bulbRadius - 2));
  bulb.setAttribute('r', String(bulbRadius));
  bulb.setAttribute('fill', '#F5F5F0');
  bulb.setAttribute('stroke', '#C8C0B0');
  bulb.setAttribute('stroke-width', '1');
  group.appendChild(bulb);

  // Mercury level (0-30C range)
  const percentage = Math.max(0, Math.min(1, temp / 30));
  const mercuryHeight = (tubeHeight - 8) * percentage + bulbRadius;

  // Mercury in bulb
  const mercuryBulb = document.createElementNS(ns, 'circle');
  mercuryBulb.setAttribute('cx', String(tubeWidth / 2));
  mercuryBulb.setAttribute('cy', String(tubeHeight + bulbRadius - 2));
  mercuryBulb.setAttribute('r', String(bulbRadius - 3));
  mercuryBulb.setAttribute('fill', mercuryColor);
  mercuryBulb.setAttribute('class', 'mercury-fill');
  group.appendChild(mercuryBulb);

  // Mercury in tube
  const mercuryTube = document.createElementNS(ns, 'rect');
  mercuryTube.setAttribute('x', String(tubeWidth / 2 - 2.5));
  mercuryTube.setAttribute('y', String(tubeHeight - mercuryHeight + bulbRadius));
  mercuryTube.setAttribute('width', '5');
  mercuryTube.setAttribute('height', String(Math.max(0, mercuryHeight - bulbRadius + 2)));
  mercuryTube.setAttribute('rx', '2.5');
  mercuryTube.setAttribute('fill', mercuryColor);
  mercuryTube.setAttribute('class', 'mercury-fill');
  group.appendChild(mercuryTube);

  // Scale markings (3 marks)
  for (let i = 0; i <= 2; i++) {
    const y = tubeHeight - ((tubeHeight - 8) * i) / 2 + 4;
    const mark = document.createElementNS(ns, 'line');
    mark.setAttribute('x1', String(tubeWidth - 1));
    mark.setAttribute('y1', String(y));
    mark.setAttribute('x2', String(tubeWidth + 2));
    mark.setAttribute('y2', String(y));
    mark.setAttribute('stroke', frameShadow);
    mark.setAttribute('stroke-width', '1');
    group.appendChild(mark);
  }

  // Temperature text (prominent, easy to read)
  const tempText = document.createElementNS(ns, 'text');
  tempText.setAttribute('x', String(tubeWidth / 2));
  tempText.setAttribute('y', String(totalHeight + 16));
  tempText.setAttribute('text-anchor', 'middle');
  tempText.setAttribute('font-size', '14');
  tempText.setAttribute('font-weight', '700');
  tempText.setAttribute('font-family', "'Fredoka', sans-serif");
  tempText.setAttribute('fill', mercuryColor);
  tempText.setAttribute('stroke', '#FFF');
  tempText.setAttribute('stroke-width', '2.5');
  tempText.setAttribute('paint-order', 'stroke fill');
  tempText.setAttribute('id', elementId);
  tempText.textContent = temp.toFixed(1) + '\u00B0';
  group.appendChild(tempText);

  group.setAttribute('transform', `translate(${position.x}, ${position.y})`);

  const containerId = position.isOutdoor ? 'outdoor-thermometer-container' : 'thermometers-container';
  const container = document.getElementById(containerId);
  if (container) container.appendChild(group);

  // Make thermometer draggable
  const storageKey = `thermometer-${elementId}`;
  loadSavedPosition(group, storageKey);
  createDraggable(group, { storageKey: storageKey });

  return tempText;
}

/**
 * Create sparkle effects around an element
 */
export function createSparkles(element: Element | null): void {
  if (!element) return;
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  for (let i = 0; i < 8; i++) {
    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle-star';
    sparkle.textContent = ['\u2728', '\u2B50', '\u{1F31F}', '\u{1F4AB}'][Math.floor(Math.random() * 4)];
    const angle = (Math.PI * 2 * i) / 8;
    const distance = 50 + Math.random() * 30;
    sparkle.style.left = centerX + 'px';
    sparkle.style.top = centerY + 'px';
    sparkle.style.setProperty('--tx', Math.cos(angle) * distance + 'px');
    sparkle.style.setProperty('--ty', Math.sin(angle) * distance + 'px');
    document.body.appendChild(sparkle);
    setTimeout(() => sparkle.remove(), 1000);
  }
}

/**
 * Thermometer UI module export
 */
export const ThermometerUI = {
  createThermometer,
  createSparkles,
};

// Expose on window for backwards compatibility
if (typeof window !== 'undefined') {
  (window as Window & { ThermometerUI?: typeof ThermometerUI }).ThermometerUI = ThermometerUI;
}
