/**
 * Color Picker Module for Hue Bulbs
 * Provides a popup with color wheel, preset swatches, and brightness slider
 */

import { Logger } from '../utils/logger';
import { HueAPI } from '../api/hue';
import { Registry } from '../core/registry';

// Helper to get HomeMonitor from Registry
function getHomeMonitor() {
    return Registry.getOptional('HomeMonitor') as { loadLights?: () => void } | undefined;
}

const NS = 'http://www.w3.org/2000/svg';

// Popup dimensions
const POPUP_WIDTH = 200;
const POPUP_HEIGHT = 280;
const COLOR_WHEEL_RADIUS = 55;

// Click detection
const CLICK_DELAY = 300; // ms to distinguish click from double-click

// Types
interface LightData {
    name?: string;
    colormode?: string;
    hue?: number;
    sat?: number;
    bri?: number;
}

interface ActiveLight extends LightData {
    id: string;
}

interface WhitePreset {
    name: string;
    ct: number;
    hex: string;
}

interface ColorPreset {
    name: string;
    hue: number;
    sat: number;
    hex: string;
}

interface ColorState {
    on?: boolean;
    hue?: number;
    sat?: number;
    ct?: number;
    bri?: number;
}

interface PendingClickData {
    lightId: string;
    lightData: LightData;
    x: number;
    y: number;
}

// State
let activePopup: SVGGElement | null = null;
let activeLight: ActiveLight | null = null;
let clickTimer: ReturnType<typeof setTimeout> | null = null;
let pendingClickData: PendingClickData | null = null;

// Preset colors
const WHITE_PRESETS: WhitePreset[] = [
    { name: 'Warm', ct: 450, hex: '#FFE4C4' }, // 2200K
    { name: 'Soft', ct: 370, hex: '#FFF5E0' }, // 2700K
    { name: 'Cool', ct: 250, hex: '#E0EFFF' }, // 4000K
    { name: 'Day', ct: 153, hex: '#D4E5FF' }, // 6500K
];

const COLOR_PRESETS: ColorPreset[] = [
    { name: 'Red', hue: 0, sat: 254, hex: '#FF0000' },
    { name: 'Orange', hue: 6000, sat: 254, hex: '#FF8000' },
    { name: 'Yellow', hue: 12000, sat: 254, hex: '#FFFF00' },
    { name: 'Green', hue: 25500, sat: 254, hex: '#00FF00' },
    { name: 'Blue', hue: 46920, sat: 254, hex: '#0000FF' },
    { name: 'Purple', hue: 56100, sat: 254, hex: '#8000FF' },
];

/**
 * Handle bulb click - distinguishes single from double click
 */
function handleBulbClick(lightId: string, lightData: LightData, event: MouseEvent): void {
    event.stopPropagation();

    if (clickTimer) {
        // Second click within delay = double click
        clearTimeout(clickTimer);
        clickTimer = null;
        pendingClickData = null;
        // Let the existing dblclick handler handle this
        return;
    }

    // First click - start timer
    pendingClickData = { lightId, lightData, x: event.clientX, y: event.clientY };
    clickTimer = setTimeout(() => {
        // Timer expired = single click
        const data = pendingClickData;
        clickTimer = null;
        pendingClickData = null;

        if (data && event.target) {
            show(data.lightId, data.lightData, event.target as Element);
        }
    }, CLICK_DELAY);
}

/**
 * Show the color picker popup
 */
function show(lightId: string, lightData: LightData, bulbElement: Element): void {
    // Close any existing popup
    hide();

    // Check if light supports color
    const hasColor = lightData.colormode !== undefined;

    activeLight = { id: lightId, ...lightData };

    // Find the pixel-bulb group (may have clicked a child element)
    const bulbGroup = bulbElement.closest('.pixel-bulb') || bulbElement;

    // Get position relative to SVG
    const svg = document.querySelector('svg');
    if (!svg) return;

    const svgRect = svg.getBoundingClientRect();
    const bulbRect = bulbGroup.getBoundingClientRect();

    // Calculate position in SVG coordinates
    const viewBox = svg.viewBox.baseVal;
    const scaleX = viewBox.width / svgRect.width;
    const scaleY = viewBox.height / svgRect.height;

    let popupX = (bulbRect.left - svgRect.left + bulbRect.width / 2) * scaleX;
    let popupY = (bulbRect.top - svgRect.top) * scaleY;

    // Adjust position to stay in bounds
    popupX = Math.max(10, Math.min(viewBox.width - POPUP_WIDTH - 10, popupX - POPUP_WIDTH / 2));
    popupY = Math.max(10, Math.min(viewBox.height - POPUP_HEIGHT - 10, popupY - POPUP_HEIGHT - 20));

    // Create popup
    activePopup = createPopup(popupX, popupY, lightData, hasColor);

    // Add to SVG
    const container = document.getElementById('color-picker-container');
    if (container) {
        container.appendChild(activePopup);
    }

    // Add click-outside listener
    setTimeout(() => {
        document.addEventListener('click', handleOutsideClick);
    }, 10);
}

/**
 * Hide the color picker popup
 */
function hide(): void {
    if (activePopup && activePopup.parentNode) {
        activePopup.parentNode.removeChild(activePopup);
    }
    activePopup = null;
    activeLight = null;
    document.removeEventListener('click', handleOutsideClick);
}

/**
 * Check if popup is open
 */
function isOpen(): boolean {
    return activePopup !== null;
}

/**
 * Handle clicks outside the popup
 */
function handleOutsideClick(event: MouseEvent): void {
    if (!activePopup) return;

    // Check if click is inside popup
    const rect = activePopup.getBoundingClientRect();
    if (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
    ) {
        return;
    }

    hide();
}

/**
 * Create the popup SVG group
 */
function createPopup(x: number, y: number, lightData: LightData, hasColor: boolean): SVGGElement {
    const group = document.createElementNS(NS, 'g') as SVGGElement;
    group.setAttribute('class', 'color-picker-popup');
    group.setAttribute('transform', `translate(${x}, ${y})`);

    // Background
    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', String(POPUP_WIDTH));
    bg.setAttribute('height', String(POPUP_HEIGHT));
    bg.setAttribute('rx', '12');
    bg.setAttribute('fill', 'rgba(44, 62, 80, 0.95)');
    bg.setAttribute('stroke', '#34495E');
    bg.setAttribute('stroke-width', '2');
    group.appendChild(bg);

    // Header with light name
    const headerText = document.createElementNS(NS, 'text');
    headerText.setAttribute('x', '15');
    headerText.setAttribute('y', '22');
    headerText.setAttribute('fill', 'white');
    headerText.setAttribute('font-size', '12');
    headerText.setAttribute('font-weight', '600');
    headerText.textContent = truncateName(lightData.name || 'Light', 18);
    group.appendChild(headerText);

    // Close button
    const closeBtn = createCloseButton(POPUP_WIDTH - 22, 15);
    group.appendChild(closeBtn);

    let yOffset = 40;

    // Color wheel (only for color-capable lights)
    if (hasColor) {
        const wheelGroup = createColorWheel(
            POPUP_WIDTH / 2,
            yOffset + COLOR_WHEEL_RADIUS,
            COLOR_WHEEL_RADIUS,
            lightData
        );
        group.appendChild(wheelGroup);
        yOffset += COLOR_WHEEL_RADIUS * 2 + 15;
    } else {
        yOffset += 10;
    }

    // White presets label
    const whiteLabel = document.createElementNS(NS, 'text');
    whiteLabel.setAttribute('x', '15');
    whiteLabel.setAttribute('y', String(yOffset));
    whiteLabel.setAttribute('fill', '#BDC3C7');
    whiteLabel.setAttribute('font-size', '10');
    whiteLabel.textContent = 'White';
    group.appendChild(whiteLabel);
    yOffset += 15;

    // White preset swatches
    const whiteSwatches = createSwatchRow(WHITE_PRESETS, 15, yOffset, true);
    group.appendChild(whiteSwatches);
    yOffset += 35;

    // Color presets (only for color-capable lights)
    if (hasColor) {
        const colorLabel = document.createElementNS(NS, 'text');
        colorLabel.setAttribute('x', '15');
        colorLabel.setAttribute('y', String(yOffset));
        colorLabel.setAttribute('fill', '#BDC3C7');
        colorLabel.setAttribute('font-size', '10');
        colorLabel.textContent = 'Colors';
        group.appendChild(colorLabel);
        yOffset += 15;

        const colorSwatches = createSwatchRow(COLOR_PRESETS, 15, yOffset, false);
        group.appendChild(colorSwatches);
        yOffset += 35;
    }

    // Brightness slider
    const briLabel = document.createElementNS(NS, 'text');
    briLabel.setAttribute('x', '15');
    briLabel.setAttribute('y', String(yOffset));
    briLabel.setAttribute('fill', '#BDC3C7');
    briLabel.setAttribute('font-size', '10');
    briLabel.textContent = 'Brightness';
    group.appendChild(briLabel);
    yOffset += 15;

    const slider = createBrightnessSlider(15, yOffset, POPUP_WIDTH - 30, lightData.bri || 127);
    group.appendChild(slider);

    // Prevent popup clicks from propagating
    group.addEventListener('click', e => e.stopPropagation());

    return group;
}

/**
 * Create close button
 */
function createCloseButton(x: number, y: number): SVGGElement {
    const btn = document.createElementNS(NS, 'g') as SVGGElement;
    btn.setAttribute('class', 'color-picker-close');
    btn.setAttribute('transform', `translate(${x}, ${y})`);
    (btn as unknown as HTMLElement).style.cursor = 'pointer';

    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('cx', '0');
    circle.setAttribute('cy', '0');
    circle.setAttribute('r', '10');
    circle.setAttribute('fill', '#E74C3C');
    btn.appendChild(circle);

    const x1 = document.createElementNS(NS, 'line');
    x1.setAttribute('x1', '-4');
    x1.setAttribute('y1', '-4');
    x1.setAttribute('x2', '4');
    x1.setAttribute('y2', '4');
    x1.setAttribute('stroke', 'white');
    x1.setAttribute('stroke-width', '2');
    btn.appendChild(x1);

    const x2 = document.createElementNS(NS, 'line');
    x2.setAttribute('x1', '4');
    x2.setAttribute('y1', '-4');
    x2.setAttribute('x2', '-4');
    x2.setAttribute('y2', '4');
    x2.setAttribute('stroke', 'white');
    x2.setAttribute('stroke-width', '2');
    btn.appendChild(x2);

    btn.addEventListener('click', e => {
        e.stopPropagation();
        hide();
    });

    return btn;
}

/**
 * Create color wheel using pure SVG
 */
function createColorWheel(
    cx: number,
    cy: number,
    radius: number,
    lightData: LightData
): SVGGElement {
    const group = document.createElementNS(NS, 'g') as SVGGElement;
    group.setAttribute('class', 'color-wheel-container');

    // Create color wheel segments
    const segments = 36; // Number of hue segments
    for (let i = 0; i < segments; i++) {
        const startAngle = (i / segments) * 2 * Math.PI - Math.PI / 2;
        const endAngle = ((i + 1) / segments) * 2 * Math.PI - Math.PI / 2;
        const hue = (i / segments) * 360;

        // Create gradient for this segment
        const gradientId = `wheel-grad-${i}-${Date.now()}`;
        const defs = document.createElementNS(NS, 'defs');
        const gradient = document.createElementNS(NS, 'radialGradient');
        gradient.setAttribute('id', gradientId);

        const stop1 = document.createElementNS(NS, 'stop');
        stop1.setAttribute('offset', '0%');
        stop1.setAttribute('stop-color', 'white');

        const stop2 = document.createElementNS(NS, 'stop');
        stop2.setAttribute('offset', '100%');
        stop2.setAttribute('stop-color', `hsl(${hue}, 100%, 50%)`);

        gradient.appendChild(stop1);
        gradient.appendChild(stop2);
        defs.appendChild(gradient);
        group.appendChild(defs);

        // Create pie segment path
        const x1 = cx + Math.cos(startAngle) * radius;
        const y1 = cy + Math.sin(startAngle) * radius;
        const x2 = cx + Math.cos(endAngle) * radius;
        const y2 = cy + Math.sin(endAngle) * radius;

        const path = document.createElementNS(NS, 'path');
        const d = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`;
        path.setAttribute('d', d);
        path.setAttribute('fill', `url(#${gradientId})`);
        path.setAttribute('stroke', 'none');
        group.appendChild(path);
    }

    // Invisible overlay circle for click handling
    const overlay = document.createElementNS(NS, 'circle');
    overlay.setAttribute('cx', String(cx));
    overlay.setAttribute('cy', String(cy));
    overlay.setAttribute('r', String(radius));
    overlay.setAttribute('fill', 'transparent');
    (overlay as unknown as HTMLElement).style.cursor = 'crosshair';

    overlay.addEventListener('click', e => {
        e.stopPropagation();

        // Get click position relative to SVG
        const svg = document.querySelector('svg');
        if (!svg || !activePopup) return;

        const svgRect = svg.getBoundingClientRect();
        const viewBox = svg.viewBox.baseVal;
        const scaleX = viewBox.width / svgRect.width;
        const scaleY = viewBox.height / svgRect.height;

        // Get popup position
        const popupTransform = activePopup.getAttribute('transform') || '';
        const match = popupTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        if (!match) return;

        const popupX = parseFloat(match[1]);
        const popupY = parseFloat(match[2]);

        // Calculate position relative to wheel center
        const mouseX = (e.clientX - svgRect.left) * scaleX - popupX - cx;
        const mouseY = (e.clientY - svgRect.top) * scaleY - popupY - cy;

        const distance = Math.sqrt(mouseX * mouseX + mouseY * mouseY);
        if (distance > radius) return;

        // Convert to hue (angle) and saturation (distance)
        let angle = Math.atan2(mouseY, mouseX) * (180 / Math.PI) + 90;
        if (angle < 0) angle += 360;

        const hueValue = Math.round((angle / 360) * 65535);
        const sat = Math.round((distance / radius) * 254);

        applyColor({ hue: hueValue, sat });
    });

    group.appendChild(overlay);

    // Add current color indicator
    if (lightData.hue !== undefined && lightData.sat !== undefined) {
        const angle = (lightData.hue / 65535) * 2 * Math.PI - Math.PI / 2;
        const dist = (lightData.sat / 254) * radius * 0.9;
        const ix = cx + Math.cos(angle) * dist;
        const iy = cy + Math.sin(angle) * dist;

        const indicator = document.createElementNS(NS, 'circle');
        indicator.setAttribute('cx', String(ix));
        indicator.setAttribute('cy', String(iy));
        indicator.setAttribute('r', '6');
        indicator.setAttribute('fill', 'none');
        indicator.setAttribute('stroke', 'white');
        indicator.setAttribute('stroke-width', '2');
        indicator.setAttribute('class', 'color-wheel-indicator');
        group.appendChild(indicator);
    }

    return group;
}

/**
 * Create row of preset swatches
 */
function createSwatchRow(
    presets: (WhitePreset | ColorPreset)[],
    _x: number,
    y: number,
    isWhite: boolean
): SVGGElement {
    const group = document.createElementNS(NS, 'g') as SVGGElement;
    const swatchSize = 24;
    const gap = 8;
    const totalWidth = presets.length * swatchSize + (presets.length - 1) * gap;
    const startX = (POPUP_WIDTH - totalWidth) / 2;

    presets.forEach((preset, i) => {
        const swatch = document.createElementNS(NS, 'g');
        swatch.setAttribute('class', 'color-swatch');
        (swatch as unknown as HTMLElement).style.cursor = 'pointer';

        const rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x', String(startX + i * (swatchSize + gap)));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(swatchSize));
        rect.setAttribute('height', String(swatchSize));
        rect.setAttribute('rx', '4');
        rect.setAttribute('fill', preset.hex);
        rect.setAttribute('stroke', '#34495E');
        rect.setAttribute('stroke-width', '1');
        swatch.appendChild(rect);

        // Tooltip
        const title = document.createElementNS(NS, 'title');
        title.textContent = preset.name;
        swatch.appendChild(title);

        // Click handler
        swatch.addEventListener('click', e => {
            e.stopPropagation();
            if (isWhite) {
                applyColor({ ct: (preset as WhitePreset).ct });
            } else {
                const colorPreset = preset as ColorPreset;
                applyColor({ hue: colorPreset.hue, sat: colorPreset.sat });
            }
        });

        group.appendChild(swatch);
    });

    return group;
}

/**
 * Create brightness slider
 */
function createBrightnessSlider(
    x: number,
    y: number,
    width: number,
    currentBri: number
): SVGGElement {
    const group = document.createElementNS(NS, 'g') as SVGGElement;
    const height = 20;
    const handleRadius = 10;

    // Track background
    const track = document.createElementNS(NS, 'rect');
    track.setAttribute('x', String(x));
    track.setAttribute('y', String(y));
    track.setAttribute('width', String(width));
    track.setAttribute('height', String(height));
    track.setAttribute('rx', String(height / 2));
    track.setAttribute('fill', '#2C3E50');
    group.appendChild(track);

    // Track gradient (dark to light)
    const gradientId = 'bri-gradient-' + Date.now();
    const defs = document.createElementNS(NS, 'defs');
    const gradient = document.createElementNS(NS, 'linearGradient');
    gradient.setAttribute('id', gradientId);
    const stop1 = document.createElementNS(NS, 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', '#333');
    const stop2 = document.createElementNS(NS, 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', '#FFF');
    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);
    group.appendChild(defs);

    const trackFill = document.createElementNS(NS, 'rect');
    trackFill.setAttribute('x', String(x));
    trackFill.setAttribute('y', String(y));
    trackFill.setAttribute('width', String(width));
    trackFill.setAttribute('height', String(height));
    trackFill.setAttribute('rx', String(height / 2));
    trackFill.setAttribute('fill', `url(#${gradientId})`);
    trackFill.setAttribute('opacity', '0.7');
    group.appendChild(trackFill);

    // Handle position
    const briRatio = (currentBri || 127) / 254;
    const handleX = x + briRatio * (width - handleRadius * 2) + handleRadius;

    // Handle
    const handle = document.createElementNS(NS, 'circle');
    handle.setAttribute('cx', String(handleX));
    handle.setAttribute('cy', String(y + height / 2));
    handle.setAttribute('r', String(handleRadius));
    handle.setAttribute('fill', 'white');
    handle.setAttribute('stroke', '#BDC3C7');
    handle.setAttribute('stroke-width', '2');
    handle.setAttribute('class', 'brightness-slider-handle');
    (handle as unknown as HTMLElement).style.cursor = 'ew-resize';
    group.appendChild(handle);

    // Brightness value text
    const valueText = document.createElementNS(NS, 'text');
    valueText.setAttribute('x', String(x + width + 10));
    valueText.setAttribute('y', String(y + height / 2 + 4));
    valueText.setAttribute('fill', 'white');
    valueText.setAttribute('font-size', '11');
    valueText.textContent = Math.round(briRatio * 100) + '%';
    group.appendChild(valueText);

    // Drag handling
    let isDragging = false;

    const updateHandle = (clientX: number): number => {
        const svg = document.querySelector('svg');
        if (!svg || !activePopup) return currentBri;

        const svgRect = svg.getBoundingClientRect();
        const viewBox = svg.viewBox.baseVal;
        const scaleX = viewBox.width / svgRect.width;

        // Get popup position
        const popupTransform = activePopup.getAttribute('transform') || '';
        const match = popupTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        if (!match) return currentBri;

        const popupX = parseFloat(match[1]);

        const mouseX = (clientX - svgRect.left) * scaleX - popupX;
        const newX = Math.max(x + handleRadius, Math.min(x + width - handleRadius, mouseX));
        const newRatio = (newX - x - handleRadius) / (width - handleRadius * 2);
        const newBri = Math.max(1, Math.round(newRatio * 254));

        handle.setAttribute('cx', String(newX));
        valueText.textContent = Math.round(newRatio * 100) + '%';

        return newBri;
    };

    const onMouseMove = (e: MouseEvent): void => {
        if (!isDragging) return;
        e.preventDefault();
        updateHandle(e.clientX);
    };

    const onMouseUp = (e: MouseEvent): void => {
        if (!isDragging) return;
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        const bri = updateHandle(e.clientX);
        applyColor({ bri });
    };

    handle.addEventListener('mousedown', e => {
        e.stopPropagation();
        e.preventDefault();
        isDragging = true;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    // Touch support
    handle.addEventListener(
        'touchstart',
        e => {
            e.stopPropagation();
            e.preventDefault();
            isDragging = true;
        },
        { passive: false }
    );

    handle.addEventListener(
        'touchmove',
        e => {
            if (!isDragging) return;
            e.preventDefault();
            updateHandle(e.touches[0].clientX);
        },
        { passive: false }
    );

    handle.addEventListener('touchend', e => {
        if (!isDragging) return;
        isDragging = false;
        if (e.changedTouches.length > 0) {
            const bri = updateHandle(e.changedTouches[0].clientX);
            applyColor({ bri });
        }
    });

    // Click on track to set position
    track.addEventListener('click', e => {
        e.stopPropagation();
        const bri = updateHandle(e.clientX);
        applyColor({ bri });
    });

    return group;
}

/**
 * Apply color to the active light
 */
async function applyColor(state: ColorState): Promise<void> {
    if (!activeLight) return;

    // Ensure light is on when setting color
    const fullState = { on: true, ...state };

    try {
        const success = await HueAPI.setLightState(activeLight.id, fullState);
        if (success) {
            // Update local state
            Object.assign(activeLight, state);
            Logger.info(`Color picker: Set light ${activeLight.id} to`, state);

            // Refresh lights display after short delay
            setTimeout(() => {
                const homeMonitor = getHomeMonitor();
                if (homeMonitor && typeof homeMonitor.loadLights === 'function') {
                    homeMonitor.loadLights();
                }
            }, 300);
        } else {
            Logger.warn(`Color picker: Failed to set light ${activeLight.id}`);
        }
    } catch (error) {
        Logger.error('Color picker error:', error);
    }
}

/**
 * Truncate name to fit in header
 */
function truncateName(name: string, maxLen: number): string {
    if (name.length <= maxLen) return name;
    return name.substring(0, maxLen - 1) + '\u2026';
}

/**
 * Initialize the module
 */
function init(): void {
    // Ensure container exists
    const svg = document.querySelector('svg');
    if (svg && !document.getElementById('color-picker-container')) {
        const container = document.createElementNS(NS, 'g');
        container.setAttribute('id', 'color-picker-container');
        svg.appendChild(container);
    }
    Logger.info('Color picker module initialized');
}

// Expose module
const ColorPicker = {
    show,
    hide,
    isOpen,
    handleBulbClick,
    init,
};

// Auto-initialize on DOM ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}

// Register with the service registry
Registry.register({
    key: 'ColorPicker',
    instance: ColorPicker,
});
