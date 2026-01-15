/**
 * Main Entry Point
 * Application bootstrap and initialization
 */

// Import core registry first
import './core/registry';

// Import config - registers APP_CONFIG with Registry
import './config/constants';

// Import utilities - registers IntervalManager with Registry
import './utils/helpers';

// Import draggable UI - registers createDraggable and loadSavedPosition
import './ui/draggable';

// Import UI modules that auto-initialize on DOM ready
import './ui/layers';
import './ui/color-picker';

// Import feature modules that register with the Registry
// IMPORTANT: These must be imported BEFORE app.ts because app.ts's
// onReady callback may run immediately if DOM is already loaded,
// and it looks up TapoControls, SonosUI, etc. from Registry
import './features/tapo';
import './features/sonos';
import './features/shield';
import './features/nest';
import './features/moose';
import './features/effects';
import './features/motion-indicators';
import './features/news-plane';

// Import and initialize the app module
// The HomeMonitor module auto-initializes via AppInitializer.onReady()
import { HomeMonitor } from './app';

// Bridge external configs (from config.js) to Registry at runtime
import { bridgeExternalConfig } from './config/config-bridge';
import { initCompat } from './core/compat';

// Initialize config bridge and backwards compatibility layer
// This allows window.* access for code that hasn't been migrated
if (typeof window !== 'undefined') {
  // Bridge config.js values (HUE_CONFIG, WEATHER_CONFIG, NEST_CONFIG)
  bridgeExternalConfig();
  // Setup window.* getters that delegate to Registry
  initCompat();
}

// Re-export for external access if needed
export { HomeMonitor };
