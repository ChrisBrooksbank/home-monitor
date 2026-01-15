import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    prettier,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                // Browser globals
                window: 'readonly',
                document: 'readonly',
                navigator: 'readonly',
                fetch: 'readonly',
                localStorage: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                console: 'readonly',
                HTMLElement: 'readonly',
                SVGElement: 'readonly',
                Element: 'readonly',
                Event: 'readonly',
                MouseEvent: 'readonly',
                KeyboardEvent: 'readonly',
                MutationObserver: 'readonly',
                ResizeObserver: 'readonly',
                Audio: 'readonly',
                Image: 'readonly',
                URL: 'readonly',
                Blob: 'readonly',
                FileReader: 'readonly',
                performance: 'readonly',
                requestAnimationFrame: 'readonly',
                cancelAnimationFrame: 'readonly',
                // Node globals
                process: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                global: 'readonly',
                // App-specific globals
                Logger: 'readonly',
                HUE_CONFIG: 'readonly',
                WEATHER_CONFIG: 'readonly',
                APP_CONFIG: 'readonly',
                HOUSE_CONFIG: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_',
            }],
            'no-console': 'off',
            'prefer-const': 'warn',
            'no-var': 'error',
        },
    },
    // Service worker configuration
    {
        files: ['service-worker.js'],
        languageOptions: {
            globals: {
                self: 'readonly',
                caches: 'readonly',
                clients: 'readonly',
                skipWaiting: 'readonly',
            },
        },
    },
    // CommonJS scripts configuration
    {
        files: ['**/*.cjs'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: {
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
            },
        },
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
        },
    },
    {
        ignores: [
            'dist/',
            'coverage/',
            'node_modules/',
            '*.config.js',
            'scripts/',
            'config.example.js',
        ],
    }
);
