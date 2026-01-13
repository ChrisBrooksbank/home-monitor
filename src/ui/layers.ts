/**
 * Layers UI Module
 * Google Maps-style layer visibility toggles for dashboard elements
 */

import { Logger } from '../utils/logger';

// =============================================================================
// CONFIGURATION
// =============================================================================

const STORAGE_KEY = 'dashboardLayers';
const CONTAINER_ID = 'layers-panel';

interface LayerConfig {
  name: string;
  icon: string;
  selectors: string[];
  default: boolean;
}

/**
 * Layer definitions with display names and target selectors
 */
const LAYER_CONFIG: Record<string, LayerConfig> = {
  temperatures: {
    name: 'Temperatures',
    icon: '\u{1F321}\uFE0F',
    selectors: ['#thermometers-container', '#outdoor-thermometer-container'],
    default: true
  },
  lights: {
    name: 'Lights',
    icon: '\u{1F4A1}',
    selectors: ['#light-indicators-container'],
    default: true
  },
  motion: {
    name: 'Motion',
    icon: '\u{1F6B6}',
    selectors: ['#motion-indicators-container'],
    default: true
  },
  media: {
    name: 'Media Controls',
    icon: '\u{1F50A}',
    selectors: ['#sonos-controls-container', '#shield-controls-container'],
    default: true
  },
  plugs: {
    name: 'Smart Plugs',
    icon: '\u{1F50C}',
    selectors: ['#tapo-plugs-container'],
    default: true
  },
  climate: {
    name: 'Climate',
    icon: '\u{1F3E0}',
    selectors: ['#nest-thermostat-display'],
    default: true
  },
  weather: {
    name: 'Weather',
    icon: '\u2600\uFE0F',
    selectors: ['#weather-info-panel'],
    default: true
  },
  effects: {
    name: 'Effects',
    icon: '\u{1F389}',
    selectors: ['#jukebox'],
    default: true
  },
  sky: {
    name: 'Sky/Ambient',
    icon: '\u{1F324}\uFE0F',
    selectors: ['#sun', '#moon', '#stars', '#rain', '#snow', '#fog'],
    default: true
  },
  character: {
    name: 'Character',
    icon: '\u{1F98C}',
    selectors: ['#moose-container'],
    default: true
  },
  news: {
    name: 'News',
    icon: '\u{1F4F0}',
    selectors: ['.news-plane', '#active-news-plane'],
    default: true
  }
};

// =============================================================================
// STATE
// =============================================================================

let isExpanded = false;
let layerStates: Record<string, boolean> = {};

// =============================================================================
// PERSISTENCE
// =============================================================================

function loadLayerStates(): void {
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

function saveLayerStates(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layerStates));
  } catch (e) {
    Logger.warn('Layers: Failed to save states:', e);
  }
}

// =============================================================================
// LAYER VISIBILITY
// =============================================================================

function setLayerVisibility(layerId: string, visible: boolean): void {
  const config = LAYER_CONFIG[layerId];
  if (!config) return;

  layerStates[layerId] = visible;
  saveLayerStates();

  // Apply visibility to all selectors
  config.selectors.forEach(selector => {
    const elements = document.querySelectorAll<HTMLElement>(selector);
    elements.forEach(el => {
      el.style.opacity = visible ? '1' : '0';
      el.style.pointerEvents = visible ? 'auto' : 'none';
      el.style.transition = 'opacity 0.3s ease';
    });
  });

  // Update checkbox UI
  const checkbox = document.getElementById(`layer-${layerId}`) as HTMLInputElement | null;
  if (checkbox) {
    checkbox.checked = visible;
  }

  Logger.debug(`Layer '${config.name}' ${visible ? 'shown' : 'hidden'}`);
}

function toggleLayer(layerId: string): void {
  const currentState = layerStates[layerId];
  setLayerVisibility(layerId, !currentState);
}

function applyAllLayerStates(): void {
  for (const [layerId, visible] of Object.entries(layerStates)) {
    const config = LAYER_CONFIG[layerId];
    if (!config) continue;

    config.selectors.forEach(selector => {
      const elements = document.querySelectorAll<HTMLElement>(selector);
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

function createLayerPanel(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = CONTAINER_ID;
  panel.className = 'layers-panel collapsed';

  // Header
  const header = document.createElement('div');
  header.className = 'layers-header';
  header.innerHTML = `
    <span class="layers-icon">\u{1F5C2}\uFE0F</span>
    <span class="layers-title">Layers</span>
    <span class="layers-toggle-icon">\u25BC</span>
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
    if (checkbox) {
      checkbox.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        setLayerVisibility(layerId, target.checked);
      });
    }

    content.appendChild(row);
  }

  panel.appendChild(content);

  return panel;
}

function togglePanelExpand(): void {
  const panel = document.getElementById(CONTAINER_ID);
  if (!panel) return;

  isExpanded = !isExpanded;
  panel.classList.toggle('collapsed', !isExpanded);
  panel.classList.toggle('expanded', isExpanded);

  const icon = panel.querySelector('.layers-toggle-icon');
  if (icon) {
    icon.textContent = isExpanded ? '\u25B2' : '\u25BC';
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

function init(): void {
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

export const LayersPanel = {
  init,
  setLayerVisibility,
  toggleLayer,
  getLayerState: (layerId: string): boolean | undefined => layerStates[layerId],
  getAllStates: (): Record<string, boolean> => ({ ...layerStates }),
  showAll: (): void => {
    Object.keys(LAYER_CONFIG).forEach(id => setLayerVisibility(id, true));
  },
  hideAll: (): void => {
    Object.keys(LAYER_CONFIG).forEach(id => setLayerVisibility(id, false));
  },
  // Re-apply states (useful after dynamic content is loaded)
  refresh: applyAllLayerStates
};

// Auto-initialize when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

// Expose on window for global access
if (typeof window !== 'undefined') {
  (window as unknown as { LayersPanel: typeof LayersPanel }).LayersPanel = LayersPanel;
}
