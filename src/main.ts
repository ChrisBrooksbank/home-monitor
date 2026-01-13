/**
 * Main Entry Point
 * Application bootstrap and initialization
 */

// Import config first - sets up window.APP_CONFIG needed by logger and other modules
import './config/constants';

// Import utilities - sets up window.IntervalManager needed by features
import './utils/helpers';

// Import UI modules that auto-initialize on DOM ready
import './ui/layers';
import './ui/color-picker';

// Import feature modules that expose window globals
// IMPORTANT: These must be imported BEFORE app.ts because app.ts's
// onReady callback may run immediately if DOM is already loaded,
// and it checks for window.TapoControls, window.SonosUI, etc.
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
