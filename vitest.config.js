import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['**/*.test.js'],
        exclude: ['**/node_modules/**', '**/dist/**'],
        setupFiles: ['./test/setup.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            include: ['js/**/*.js', 'proxies/**/*.js'],
            exclude: [
                '**/node_modules/**',
                '**/*.test.js',
                '**/test/**',
                'js/app.js' // Main entry point, integration tested
            ]
        },
        // Separate environments for frontend vs backend tests
        environmentMatchGlobs: [
            ['proxies/**/*.test.js', 'node'],
            ['scripts/**/*.test.js', 'node']
        ]
    }
});
