/**
 * Environment Configuration
 * Utilities for handling dev/prod environment differences
 */

// Vite injects these at build time
declare const __DEV__: boolean;
declare const __PROD__: boolean;

/**
 * Environment utilities
 */
export const Env = {
    /**
     * Is development mode
     */
    get isDev(): boolean {
        return typeof __DEV__ !== 'undefined' ? __DEV__ : false;
    },

    /**
     * Is production mode
     */
    get isProd(): boolean {
        return typeof __PROD__ !== 'undefined' ? __PROD__ : true;
    },

    /**
     * Current mode name
     */
    get mode(): 'development' | 'production' {
        return this.isDev ? 'development' : 'production';
    },

    /**
     * Get environment-specific value
     */
    select<T>(options: { dev: T; prod: T }): T {
        return this.isDev ? options.dev : options.prod;
    },
} as const;
