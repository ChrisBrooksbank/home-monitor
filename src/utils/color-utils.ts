/**
 * Color Utilities
 * Shared color conversion functions for temperature display and light colors
 */

import type { HueLightState } from '../types';

/**
 * Get color representing a temperature value
 */
export function getTemperatureColor(temp: number): string {
    if (temp < 10) return '#4169E1';
    if (temp < 15) return '#00CED1';
    if (temp < 20) return '#32CD32';
    if (temp < 25) return '#FFA500';
    return '#FF4500';
}

/**
 * Convert HSV color to hex
 */
function hsvToHex(h: number, s: number, v: number): string {
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r: number, g: number, b: number;
    if (h < 60) {
        r = c;
        g = x;
        b = 0;
    } else if (h < 120) {
        r = x;
        g = c;
        b = 0;
    } else if (h < 180) {
        r = 0;
        g = c;
        b = x;
    } else if (h < 240) {
        r = 0;
        g = x;
        b = c;
    } else if (h < 300) {
        r = x;
        g = 0;
        b = c;
    } else {
        r = c;
        g = 0;
        b = x;
    }
    const toHex = (n: number): string =>
        Math.round((n + m) * 255)
            .toString(16)
            .padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert CIE xy color space to hex
 */
function xyToHex(x: number, y: number, bri: number): string {
    const z = 1 - x - y;
    const Y = bri / 254;
    const X = (Y / y) * x;
    const Z = (Y / y) * z;
    let r = X * 1.656492 - Y * 0.354851 - Z * 0.255038;
    let g = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
    let b = X * 0.051713 - Y * 0.121364 + Z * 1.01153;
    const gamma = (n: number): number =>
        n <= 0.0031308 ? 12.92 * n : 1.055 * Math.pow(n, 1 / 2.4) - 0.055;
    r = Math.max(0, Math.min(1, gamma(r)));
    g = Math.max(0, Math.min(1, gamma(g)));
    b = Math.max(0, Math.min(1, gamma(b)));
    const toHex = (n: number): string =>
        Math.round(n * 255)
            .toString(16)
            .padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Convert Hue light state to hex color
 */
export function hueStateToColor(state: HueLightState): string {
    if (
        state.colormode === 'hs' &&
        state.hue !== undefined &&
        state.sat !== undefined &&
        state.bri !== undefined
    ) {
        const h = (state.hue / 65535) * 360;
        const s = state.sat / 254;
        const v = state.bri / 254;
        return hsvToHex(h, s, v);
    } else if (state.colormode === 'ct' && state.ct !== undefined) {
        const ct = state.ct;
        if (ct < 250) return '#E0EFFF';
        if (ct < 350) return '#FFF5E0';
        return '#FFE4C4';
    } else if (state.colormode === 'xy' && state.xy && state.bri !== undefined) {
        return xyToHex(state.xy[0], state.xy[1], state.bri);
    }
    return '#FFD700';
}

/**
 * Darken a hex color by 30%
 */
export function darkenColor(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const factor = 0.7;
    const toHex = (n: number): string =>
        Math.round(n * factor)
            .toString(16)
            .padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Color utilities export
 */
const ColorUtils = {
    getTemperatureColor,
    hsvToHex,
    xyToHex,
    hueStateToColor,
    darkenColor,
};
