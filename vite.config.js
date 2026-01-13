import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => ({
  // Base public path
  base: './',

  // Define global constants
  define: {
    __DEV__: mode === 'development',
    __PROD__: mode === 'production'
  },

  // Resolve path aliases from tsconfig
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@api': resolve(__dirname, 'src/api'),
      '@core': resolve(__dirname, 'src/core'),
      '@features': resolve(__dirname, 'src/features'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@config': resolve(__dirname, 'src/config'),
      '@types': resolve(__dirname, 'src/types')
    }
  },

  // Server configuration
  server: {
    port: 5173,
    open: true, // Auto-open browser
    cors: true
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
      external: []
    }
  },

  // Optimize dependencies
  optimizeDeps: {
    include: []
  },

  // Asset handling
  assetsInclude: ['**/*.wav', '**/*.mp3'],

  // Preview server (for production build testing)
  preview: {
    port: 4173,
    open: true
  }
}));
