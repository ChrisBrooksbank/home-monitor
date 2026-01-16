/**
 * Configuration Loader
 * Loads and validates home.config.json with fail-fast behavior
 */

import { HomeConfigSchema, ConfigValidationError, type HomeConfig } from './schema';
import { defaults, deepMerge } from './defaults';

// Cached config after loading
let cachedConfig: HomeConfig | null = null;

// Track initialization state
let initPromise: Promise<HomeConfig> | null = null;

/**
 * Check if running in browser environment
 */
function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Fetch config file in browser environment
 */
async function fetchConfigBrowser(): Promise<unknown> {
    const response = await fetch('/home.config.json');

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(
                'Configuration file not found.\n' +
                    'Copy home.config.example.json to home.config.json and configure your settings.'
            );
        }
        throw new Error(`Failed to load configuration: ${response.status} ${response.statusText}`);
    }

    // Check Content-Type to handle Vite serving HTML for missing files (SPA fallback)
    const contentType = response.headers.get('Content-Type') || '';
    if (!contentType.includes('application/json')) {
        throw new Error(
            'Configuration file not found.\n' +
                'Copy home.config.example.json to home.config.json and configure your settings.'
        );
    }

    return response.json();
}

/**
 * Read config file in Node environment
 */
async function readConfigNode(): Promise<unknown> {
    // Dynamic import for Node.js modules
    const fs = await import('fs');
    const path = await import('path');

    const configPath = path.join(process.cwd(), 'home.config.json');

    if (!fs.existsSync(configPath)) {
        throw new Error(
            'Configuration file not found.\n' +
                'Copy home.config.example.json to home.config.json and configure your settings.'
        );
    }

    const content = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(content);
}

/**
 * Detect placeholder values that indicate unconfigured settings
 */
function hasPlaceholder(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const placeholders = ['YOUR-', 'YOUR_', 'XXX', 'your-', 'your_'];
    return placeholders.some(p => value.includes(p));
}

/**
 * Validate service configurations and warn about placeholders
 */
function validateServices(config: HomeConfig): void {
    const warnings: string[] = [];

    // Check Hue config
    if (config.services.hue) {
        if (hasPlaceholder(config.services.hue.bridgeIp)) {
            warnings.push('services.hue.bridgeIp contains placeholder value');
            config.services.hue = null;
        } else if (hasPlaceholder(config.services.hue.username)) {
            warnings.push('services.hue.username contains placeholder value');
            config.services.hue = null;
        }
    }

    // Check Weather config
    if (config.services.weather) {
        if (hasPlaceholder(config.services.weather.apiKey)) {
            warnings.push('services.weather.apiKey contains placeholder value');
            config.services.weather = null;
        }
    }

    // Check Nest config
    if (config.services.nest) {
        if (
            hasPlaceholder(config.services.nest.clientId) ||
            hasPlaceholder(config.services.nest.clientSecret) ||
            hasPlaceholder(config.services.nest.projectId)
        ) {
            warnings.push('services.nest contains placeholder values');
            config.services.nest = null;
        }
    }

    if (warnings.length > 0) {
        console.warn('[Config] Services with placeholder values have been disabled:', warnings);
    }
}

/**
 * Load and validate configuration
 * Call this once at app startup before accessing config
 *
 * @throws ConfigValidationError if validation fails
 * @throws Error if config file cannot be loaded
 */
export async function loadConfig(): Promise<HomeConfig> {
    // Return cached config if already loaded
    if (cachedConfig) {
        return cachedConfig;
    }

    // Return existing promise if loading in progress
    if (initPromise) {
        return initPromise;
    }

    initPromise = (async () => {
        // Load raw config
        const rawConfig = isBrowser() ? await fetchConfigBrowser() : await readConfigNode();

        // Merge with defaults
        const merged = deepMerge(defaults as HomeConfig, rawConfig as Partial<HomeConfig>);

        // Validate with Zod
        const result = HomeConfigSchema.safeParse(merged);

        if (!result.success) {
            const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
            throw new ConfigValidationError(errors);
        }

        // Check for placeholder values and disable those services
        validateServices(result.data);

        cachedConfig = result.data;
        console.info('[Config] Configuration loaded successfully');

        return cachedConfig;
    })();

    return initPromise;
}

/**
 * Get the loaded configuration synchronously
 * Must call loadConfig() first during app initialization
 *
 * @throws Error if config has not been loaded yet
 */
export function getConfig(): HomeConfig {
    if (!cachedConfig) {
        throw new Error(
            'Configuration not loaded. Call loadConfig() during app initialization before accessing config.'
        );
    }
    return cachedConfig;
}

/**
 * Check if configuration has been loaded
 */
export function isConfigLoaded(): boolean {
    return cachedConfig !== null;
}

/**
 * Check if a service is properly configured
 */
export function isServiceConfigured(service: 'hue' | 'weather' | 'nest'): boolean {
    if (!cachedConfig) return false;

    switch (service) {
        case 'hue':
            return !!(cachedConfig.services.hue?.bridgeIp && cachedConfig.services.hue?.username);
        case 'weather':
            return !!cachedConfig.services.weather?.apiKey;
        case 'nest':
            return !!(
                cachedConfig.services.nest?.clientId &&
                cachedConfig.services.nest?.projectId &&
                cachedConfig.services.nest?.tokens?.accessToken
            );
        default:
            return false;
    }
}

/**
 * Get proxy URL for a service
 */
export function getProxyUrl(service: keyof HomeConfig['proxies']): string {
    const config = getConfig();
    const proxy = config.proxies[service];
    return `http://${proxy.host}:${proxy.port}`;
}

/**
 * Reset config (for testing purposes)
 */
export function resetConfig(): void {
    cachedConfig = null;
    initPromise = null;
}

/**
 * Set config directly (for testing purposes)
 */
export function setConfig(config: HomeConfig): void {
    cachedConfig = config;
}
