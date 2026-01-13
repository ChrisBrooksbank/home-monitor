/**
 * Draggable UI Module
 * Generic drag-and-drop functionality for SVG and HTML elements
 */

import type { DraggableOptions, TransformData, Position } from '../types';

/**
 * Load saved position from localStorage
 */
export function loadSavedPosition(
  element: SVGElement | HTMLElement | null,
  storageKey: string
): void {
  if (!element) return;

  const savedPosition = localStorage.getItem(storageKey);
  if (savedPosition) {
    const position = JSON.parse(savedPosition) as Position;
    const currentTransform = element.getAttribute('transform') ?? '';
    const scaleMatch = currentTransform.match(/scale\([^)]+\)/);
    const rotateMatch = currentTransform.match(/rotate\([^)]+\)/);

    let newTransform = `translate(${position.x}, ${position.y})`;
    if (scaleMatch) newTransform += ` ${scaleMatch[0]}`;
    if (rotateMatch) newTransform += ` ${rotateMatch[0]}`;

    element.setAttribute('transform', newTransform);
  }
}

/**
 * Create draggable behavior for an SVG or HTML element
 */
export function createDraggable(
  element: SVGElement | HTMLElement,
  options: DraggableOptions = {}
): () => void {
  const {
    storageKey,
    excludeSelector = null,
    cursor = 'move',
    activeCursor = null,
    onStart = null,
    onMove = null,
    onEnd = null,
    customSave = null,
  } = options;

  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let currentTransform: TransformData = { x: 0, y: 0, scale: '', rotate: '' };

  // Set default cursor
  if (typeof cursor === 'string') {
    (element as HTMLElement).style.cursor = cursor;
  }

  function handleStart(e: MouseEvent | TouchEvent): void {
    // Skip if clicking on excluded elements
    if (excludeSelector && (e.target as Element).closest(excludeSelector)) {
      return;
    }

    // Call custom onStart if provided (can return false to cancel)
    if (onStart && onStart(e) === false) {
      return;
    }

    isDragging = true;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    startX = clientX;
    startY = clientY;

    const transform = element.getAttribute('transform') ?? '';
    const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
    currentTransform = {
      x: match ? parseFloat(match[1]) : 0,
      y: match ? parseFloat(match[2]) : 0,
      scale: transform.match(/scale\([^)]+\)/)?.[0] ?? '',
      rotate: transform.match(/rotate\([^)]+\)/)?.[0] ?? '',
    };

    (element as HTMLElement).style.opacity = '0.7';
    if (activeCursor) {
      (element as HTMLElement).style.cursor = activeCursor;
    }

    e.preventDefault();
    e.stopPropagation();
  }

  function handleMove(e: MouseEvent | TouchEvent): void {
    if (!isDragging) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const dx = clientX - startX;
    const dy = clientY - startY;

    // Call custom onMove if provided
    if (onMove) {
      onMove({
        dx,
        dy,
        clientX,
        clientY,
        startX,
        startY,
        currentTransform,
        element,
      });
    } else {
      // Default behavior: update position while preserving scale/rotate
      const newX = currentTransform.x + dx;
      const newY = currentTransform.y + dy;
      let newTransform = `translate(${newX}, ${newY})`;
      if (currentTransform.scale) newTransform += ` ${currentTransform.scale}`;
      if (currentTransform.rotate) newTransform += ` ${currentTransform.rotate}`;
      element.setAttribute('transform', newTransform);
    }
  }

  function handleEnd(e: MouseEvent | TouchEvent): void {
    if (!isDragging) return;
    isDragging = false;

    (element as HTMLElement).style.opacity = '1';
    if (activeCursor) {
      (element as HTMLElement).style.cursor = cursor;
    }

    // Call custom onEnd or save if provided
    if (onEnd) {
      onEnd(e, element);
    } else if (customSave) {
      customSave(element);
    } else if (storageKey) {
      // Default save behavior
      const transform = element.getAttribute('transform') ?? '';
      const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
      if (match) {
        const position: Position = {
          x: parseFloat(match[1]),
          y: parseFloat(match[2]),
        };
        localStorage.setItem(storageKey, JSON.stringify(position));
      }
    }
  }

  // Add event listeners
  element.addEventListener('mousedown', handleStart as EventListener);
  element.addEventListener('touchstart', handleStart as EventListener, {
    passive: false,
  });

  document.addEventListener('mousemove', handleMove as EventListener);
  document.addEventListener('touchmove', handleMove as EventListener, {
    passive: false,
  });

  document.addEventListener('mouseup', handleEnd as EventListener);
  document.addEventListener('touchend', handleEnd as EventListener);

  // Return cleanup function
  return function cleanup(): void {
    element.removeEventListener('mousedown', handleStart as EventListener);
    element.removeEventListener('touchstart', handleStart as EventListener);
    document.removeEventListener('mousemove', handleMove as EventListener);
    document.removeEventListener('touchmove', handleMove as EventListener);
    document.removeEventListener('mouseup', handleEnd as EventListener);
    document.removeEventListener('touchend', handleEnd as EventListener);
  };
}

/**
 * Extract position from transform attribute
 */
export function getPositionFromTransform(element: SVGElement | HTMLElement): Position {
  const transform = element.getAttribute('transform') ?? '';
  const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
  return {
    x: match ? parseFloat(match[1]) : 0,
    y: match ? parseFloat(match[2]) : 0,
  };
}

/**
 * Set position on element while preserving other transforms
 */
export function setPosition(
  element: SVGElement | HTMLElement,
  x: number,
  y: number
): void {
  const transform = element.getAttribute('transform') ?? '';
  const scaleMatch = transform.match(/scale\([^)]+\)/);
  const rotateMatch = transform.match(/rotate\([^)]+\)/);

  let newTransform = `translate(${x}, ${y})`;
  if (scaleMatch) newTransform += ` ${scaleMatch[0]}`;
  if (rotateMatch) newTransform += ` ${rotateMatch[0]}`;

  element.setAttribute('transform', newTransform);
}

// Expose on window for global access
if (typeof window !== 'undefined') {
  window.createDraggable = createDraggable;
  window.loadSavedPosition = loadSavedPosition;
}
