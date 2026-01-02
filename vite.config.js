import { defineConfig } from 'vite';

export default defineConfig({
  // Base public path
  base: './',

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

    // Optimize bundle
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep Logger statements
        drop_debugger: true
      }
    },

    // Chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['config.js', 'nest-config.js'],
          'utils': [
            './js/utils/logger.js',
            './js/utils/helpers.js'
          ],
          'api': [
            './js/api/sonos.js',
            './js/api/tapo.js'
          ]
        }
      }
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
});
