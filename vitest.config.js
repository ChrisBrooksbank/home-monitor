import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['src/**/*.test.ts'],
        exclude: ['**/node_modules/**', '**/dist/**', 'js/**/*.test.js', 'proxies/**/*.test.js'],
        setupFiles: ['./src/test/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            include: ['src/**/*.ts'],
            exclude: [
                '**/node_modules/**',
                '**/*.test.ts',
                'src/test/**',
                'src/**/*.d.ts'
            ]
        },
        // Separate environments for frontend vs backend tests
        environmentMatchGlobs: [
            ['src/proxies/**/*.test.ts', 'node'],
            ['src/scripts/**/*.test.ts', 'node']
        ]
    }
});
