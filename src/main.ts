/**
 * Main Entry Point
 * Application bootstrap and initialization
 */

// Import core registry first
import './core/registry';

// Bridge external configs (from config.js) to Registry BEFORE feature modules
// config.js and nest-config.js are loaded via script tags before this module
import { bridgeExternalConfig } from './config/config-bridge';
if (typeof window !== 'undefined') {
  bridgeExternalConfig();
}

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

// Re-export for external access if needed
export { HomeMonitor };
