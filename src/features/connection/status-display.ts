/**
 * Connection Status Display
 * Wheelie bin LED status indicators and popup display
 */

import { AppEvents } from '../../core/events';
import { ConnectionMonitor } from '../../core/connection-monitor';
import { createDraggable, loadSavedPosition } from '../../ui/draggable';

// Module state
let binPopupVisible = false;

// Service display names for tooltips
const serviceNames: Record<string, string> = {
    hue: 'Hue Bridge',
    sonos: 'Sonos',
    tapo: 'Tapo Plugs',
    shield: 'SHIELD TV',
    nest: 'Nest Thermostat',
};

/**
 * Initialize wheelie bin draggable behavior
 */
export function initWheelieBinDraggable(): void {
    const bin = document.getElementById('wheelie-bin');
    if (bin) {
        const storageKey = 'wheelie-bin-position';
        loadSavedPosition(bin, storageKey);
        createDraggable(bin, { storageKey: storageKey });
    }
}

/**
 * Update a bin LED color based on online status
 * @param service - The service identifier (hue, sonos, tapo, shield, nest)
 * @param online - Whether the service is online
 * @param errorMsg - Optional error message to show in tooltip when offline
 */
function updateBinLed(service: string, online: boolean, errorMsg?: string): void {
    const led = document.getElementById(`bin-led-${service}`);
    const displayName = serviceNames[service] || service;

    if (led) {
        led.setAttribute('fill', online ? '#4CAF50' : '#F44336');

        // Update tooltip with error details on hover
        const title = led.querySelector('title');
        if (title) {
            title.textContent = online
                ? `${displayName}: Online`
                : `${displayName}: Offline${errorMsg ? ` - ${errorMsg}` : ''}`;
        }
    }

    // Also update popup indicator if it exists
    const popupGroup = document.getElementById(`popup-status-${service}`);
    if (popupGroup) {
        const circle = popupGroup.querySelector('circle');
        if (circle) {
            circle.setAttribute('fill', online ? '#4CAF50' : '#F44336');
        }
        const statusText = document.getElementById(`popup-status-${service}-text`);
        if (statusText) {
            statusText.textContent = online ? 'Online' : 'Offline';
            statusText.setAttribute('fill', online ? '#4CAF50' : '#F44336');
        }
    }
}

/**
 * Toggle the proxy status popup visibility
 */
function toggleBinPopup(): void {
    const popup = document.getElementById('proxy-status-popup');
    const bin = document.getElementById('wheelie-bin');
    if (!popup || !bin) return;

    binPopupVisible = !binPopupVisible;

    if (binPopupVisible) {
        // Position popup near the bin
        const binTransform = bin.getAttribute('transform') || '';
        const match = binTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);
        const binX = match ? parseFloat(match[1]) : 920;
        const binY = match ? parseFloat(match[2]) : 555;

        popup.setAttribute('transform', `translate(${binX - 140}, ${binY - 100})`);
        popup.style.display = 'block';
    } else {
        popup.style.display = 'none';
    }
}

/**
 * Initialize wheelie bin click handler and status subscriptions
 */
export function initBinStatusDisplay(): void {
    const bin = document.getElementById('wheelie-bin');
    if (!bin) return;

    // Click handler for popup toggle
    bin.addEventListener('click', e => {
        // Don't toggle if we just finished dragging
        if (e.defaultPrevented) return;
        toggleBinPopup();
    });

    // Close popup when clicking elsewhere
    document.addEventListener('click', e => {
        if (!binPopupVisible) return;
        const popup = document.getElementById('proxy-status-popup');
        const target = e.target as Element;
        if (!bin.contains(target) && popup && !popup.contains(target)) {
            binPopupVisible = false;
            popup.style.display = 'none';
        }
    });

    // Subscribe to connection events
    AppEvents.on('connection:hue:online', () => updateBinLed('hue', true));
    AppEvents.on('connection:hue:offline', (data: { error?: string }) => {
        updateBinLed('hue', false, data.error);
    });
    AppEvents.on('connection:proxy:online', (data: { proxy: string }) => {
        updateBinLed(data.proxy, true);
    });
    AppEvents.on('connection:proxy:offline', (data: { proxy: string; error?: string }) => {
        updateBinLed(data.proxy, false, data.error);
    });
    AppEvents.on('connection:nest:online', () => updateBinLed('nest', true));
    AppEvents.on('connection:nest:offline', (data: { error?: string }) => {
        updateBinLed('nest', false, data.error);
    });

    // Nest re-auth button click handler
    const reauthBtn = document.getElementById('nest-reauth-btn');
    if (reauthBtn) {
        reauthBtn.addEventListener('click', async e => {
            e.stopPropagation(); // Don't close popup when clicking auth button
            try {
                const response = await fetch('http://localhost:3003/auth/url');
                if (!response.ok) {
                    console.error('Failed to get auth URL');
                    return;
                }
                const data = await response.json();
                if (data.url) {
                    window.open(data.url, '_blank', 'width=600,height=700');
                }
            } catch (err) {
                console.error('Failed to start Nest auth:', err);
            }
        });
    }

    // Set initial states from ConnectionMonitor (with error messages if offline)
    const services = ['hue', 'sonos', 'tapo', 'shield', 'nest'] as const;
    for (const service of services) {
        const isOnline = ConnectionMonitor.isOnline(service);
        const errorMsg = isOnline
            ? undefined
            : (ConnectionMonitor.getErrorMessage(service) ?? undefined);
        updateBinLed(service, isOnline, errorMsg);
    }
}
