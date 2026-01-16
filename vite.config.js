import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ mode }) => ({
    // Base public path
    base: './',

    // Plugins
    plugins: [tsconfigPaths()],

    // Define global constants
    define: {
        __DEV__: mode === 'development',
        __PROD__: mode === 'production',
    },

    // Server configuration
    server: {
        port: 5173,
        open: true, // Auto-open browser
        cors: true,
    },

    // Build configuration
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: true, // Enable source maps for debugging

        // Optimize bundle (use esbuild for faster builds)
        minify: 'esbuild',

        // Rollup options
        rollupOptions: {
            // Don't include config files that are loaded separately
            external: [],
        },
    },

    // Optimize dependencies
    optimizeDeps: {
        include: [],
    },

    // Asset handling
    assetsInclude: ['**/*.wav', '**/*.mp3'],

    // Preview server (for production build testing)
    preview: {
        port: 4173,
        open: true,
    },
}));
