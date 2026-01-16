/**
 * Main Entry Point
 * Application bootstrap and initialization
 */

// Import config loader first - this must be loaded before anything else
import { loadConfig, ConfigValidationError } from './config';

// Import core registry
import './core/registry';

// Bootstrap the application
async function bootstrap(): Promise<void> {
    // Load and validate configuration first
    try {
        await loadConfig();
        console.info('[Bootstrap] Configuration loaded successfully');
    } catch (error) {
        if (error instanceof ConfigValidationError) {
            console.error('[Bootstrap] Configuration validation failed:', error.message);
            showConfigError(error.message);
            return;
        }
        console.error('[Bootstrap] Failed to load configuration:', error);
        showConfigError(
            error instanceof Error ? error.message : 'Unknown error loading configuration'
        );
        return;
    }

    // Now import the rest of the application modules
    // These imports are dynamic to ensure config is loaded first
    await import('./config/mappings');
    await import('./utils/helpers');
    await import('./ui/draggable');
    await import('./ui/layers');
    await import('./ui/color-picker');
    await import('./features/tapo');
    await import('./features/sonos');
    await import('./features/shield');
    await import('./features/nest');
    await import('./features/moose');
    await import('./features/effects');
    await import('./features/motion-indicators');
    await import('./features/news-plane');

    // Import and initialize the app module
    const { HomeMonitor } = await import('./app');

    // Expose HomeMonitor for debugging if needed
    if (typeof window !== 'undefined') {
        (window as Window & { HomeMonitor?: typeof HomeMonitor }).HomeMonitor = HomeMonitor;
    }
}

/**
 * Show configuration error to user
 */
function showConfigError(message: string): void {
    document.body.innerHTML = `
        <div style="
            font-family: system-ui, -apple-system, sans-serif;
            max-width: 600px;
            margin: 100px auto;
            padding: 24px;
            background: #fee;
            border: 2px solid #c00;
            border-radius: 8px;
        ">
            <h1 style="color: #c00; margin: 0 0 16px 0;">Configuration Error</h1>
            <pre style="
                background: #fff;
                padding: 16px;
                border-radius: 4px;
                overflow-x: auto;
                white-space: pre-wrap;
                word-wrap: break-word;
            ">${escapeHtml(message)}</pre>
            <p style="margin: 16px 0 0 0; color: #666;">
                Please check your <code>home.config.json</code> file.<br>
                Copy <code>home.config.example.json</code> and update with your settings.
            </p>
        </div>
    `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Start the application
bootstrap().catch(error => {
    console.error('[Bootstrap] Unexpected error:', error);
});
