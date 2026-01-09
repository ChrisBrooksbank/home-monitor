/**
 * Layers UI Module
 * Google Maps-style layer visibility toggles for dashboard elements
 */

(function() {
    'use strict';

    // =============================================================================
    // CONFIGURATION
    // =============================================================================

    const STORAGE_KEY = 'dashboardLayers';
    const CONTAINER_ID = 'layers-panel';

    /**
     * Layer definitions with display names and target selectors
     */
    const LAYER_CONFIG = {
        temperatures: {
            name: 'Temperatures',
            icon: '🌡️',
            selectors: ['#thermometers-container', '#outdoor-thermometer-container'],
            default: true
        },
        lights: {
            name: 'Lights',
            icon: '💡',
            selectors: ['#light-indicators-container'],
            default: true
        },
        motion: {
            name: 'Motion',
            icon: '🚶',
            selectors: ['#motion-indicators-container'],
            default: true
        },
        media: {
            name: 'Media Controls',
            icon: '🔊',
            selectors: ['#sonos-controls-container', '#shield-controls-container'],
            default: true
        },
        plugs: {
            name: 'Smart Plugs',
            icon: '🔌',
            selectors: ['#tapo-plugs-container'],
            default: true
        },
        climate: {
            name: 'Climate',
            icon: '🏠',
            selectors: ['#nest-thermostat-display'],
            default: true
        },
        weather: {
            name: 'Weather',
            icon: '☀️',
            selectors: ['#weather-info-panel'],
            default: true
        },
        effects: {
            name: 'Effects',
            icon: '🎉',
            selectors: ['#jukebox'],
            default: true
        },
        sky: {
            name: 'Sky/Ambient',
            icon: '🌤️',
            selectors: ['#sun', '#moon', '#stars', '#rain', '#snow', '#fog'],
            default: true
        },
        character: {
            name: 'Character',
            icon: '🦌',
            selectors: ['#moose-container'],
            default: true
        },
        news: {
            name: 'News',
            icon: '📰',
            selectors: ['.news-plane', '#active-news-plane'],
            default: true
        }
    };

    // =============================================================================
    // STATE
    // =============================================================================

    let isExpanded = false;
    let layerStates = {};

    // =============================================================================
    // PERSISTENCE
    // =============================================================================

    function loadLayerStates() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                layerStates = JSON.parse(saved);
            }
        } catch (e) {
            Logger.warn('Layers: Failed to load states:', e);
        }

        // Apply defaults for any missing layers
        for (const [key, config] of Object.entries(LAYER_CONFIG)) {
            if (layerStates[key] === undefined) {
                layerStates[key] = config.default;
            }
        }
    }

    function saveLayerStates() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(layerStates));
        } catch (e) {
            Logger.warn('Layers: Failed to save states:', e);
        }
    }

    // =============================================================================
    // LAYER VISIBILITY
    // =============================================================================

    function setLayerVisibility(layerId, visible) {
        const config = LAYER_CONFIG[layerId];
        if (!config) return;

        layerStates[layerId] = visible;
        saveLayerStates();

        // Apply visibility to all selectors
        config.selectors.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                el.style.opacity = visible ? '1' : '0';
                el.style.pointerEvents = visible ? 'auto' : 'none';
                el.style.transition = 'opacity 0.3s ease';
            });
        });

        // Update checkbox UI
        const checkbox = document.getElementById(`layer-${layerId}`);
        if (checkbox) {
            checkbox.checked = visible;
        }

        Logger.debug(`Layer '${config.name}' ${visible ? 'shown' : 'hidden'}`);
    }

    function toggleLayer(layerId) {
        const currentState = layerStates[layerId];
        setLayerVisibility(layerId, !currentState);
    }

    function applyAllLayerStates() {
        for (const [layerId, visible] of Object.entries(layerStates)) {
            const config = LAYER_CONFIG[layerId];
            if (!config) continue;

            config.selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => {
                    el.style.opacity = visible ? '1' : '0';
                    el.style.pointerEvents = visible ? 'auto' : 'none';
                });
            });
        }
    }

    // =============================================================================
    // UI RENDERING
    // =============================================================================

    function createLayerPanel() {
        const panel = document.createElement('div');
        panel.id = CONTAINER_ID;
        panel.className = 'layers-panel collapsed';

        // Header
        const header = document.createElement('div');
        header.className = 'layers-header';
        header.innerHTML = `
            <span class="layers-icon">🗂️</span>
            <span class="layers-title">Layers</span>
            <span class="layers-toggle-icon">▼</span>
        `;
        header.addEventListener('click', togglePanelExpand);
        panel.appendChild(header);

        // Content (checkboxes)
        const content = document.createElement('div');
        content.className = 'layers-content';

        for (const [layerId, config] of Object.entries(LAYER_CONFIG)) {
            const row = document.createElement('label');
            row.className = 'layer-row';
            row.innerHTML = `
                <input type="checkbox" id="layer-${layerId}"
                       ${layerStates[layerId] ? 'checked' : ''}>
                <span class="layer-icon">${config.icon}</span>
                <span class="layer-name">${config.name}</span>
            `;

            const checkbox = row.querySelector('input');
            checkbox.addEventListener('change', (e) => {
                setLayerVisibility(layerId, e.target.checked);
            });

            content.appendChild(row);
        }

        panel.appendChild(content);

        return panel;
    }

    function togglePanelExpand() {
        const panel = document.getElementById(CONTAINER_ID);
        if (!panel) return;

        isExpanded = !isExpanded;
        panel.classList.toggle('collapsed', !isExpanded);
        panel.classList.toggle('expanded', isExpanded);

        const icon = panel.querySelector('.layers-toggle-icon');
        if (icon) {
            icon.textContent = isExpanded ? '▲' : '▼';
        }
    }

    // =============================================================================
    // INITIALIZATION
    // =============================================================================

    function init() {
        Logger.info('Initializing Layers panel...');

        // Load persisted states
        loadLayerStates();

        // Create and insert panel into house-container
        const houseContainer = document.querySelector('.house-container');
        if (!houseContainer) {
            Logger.error('Layers: house-container not found');
            return;
        }

        // Remove existing panel if re-initializing
        const existing = document.getElementById(CONTAINER_ID);
        if (existing) existing.remove();

        // Create and insert panel
        const panel = createLayerPanel();
        houseContainer.appendChild(panel);

        // Apply saved visibility states after a short delay
        // (allows dynamically created elements to be added first)
        setTimeout(applyAllLayerStates, 500);

        Logger.success('Layers panel initialized');
    }

    // =============================================================================
    // PUBLIC API
    // =============================================================================

    window.LayersPanel = {
        init,
        setLayerVisibility,
        toggleLayer,
        getLayerState: (layerId) => layerStates[layerId],
        getAllStates: () => ({ ...layerStates }),
        showAll: () => {
            Object.keys(LAYER_CONFIG).forEach(id => setLayerVisibility(id, true));
        },
        hideAll: () => {
            Object.keys(LAYER_CONFIG).forEach(id => setLayerVisibility(id, false));
        },
        // Re-apply states (useful after dynamic content is loaded)
        refresh: applyAllLayerStates
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
