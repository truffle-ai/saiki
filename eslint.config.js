import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';

export default [
    js.configs.recommended,
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                console: 'readonly',
                process: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                global: 'readonly',
                require: 'readonly',
                __dirname: 'readonly',
                module: 'readonly',
                document: 'readonly',
                window: 'readonly',
                HTMLElement: 'readonly',
                HTMLAnchorElement: 'readonly',
                HTMLImageElement: 'readonly',
                Element: 'readonly',
                Node: 'readonly',
                clearInterval: 'readonly',
                setInterval: 'readonly',
                Buffer: 'readonly',
                URL: 'readonly'
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
            'no-console': 'off',
            'no-unused-vars': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        },
    },
    {
        ignores: ['node_modules/**', 'dist/**', '.cursor/**'],
    },
    prettier,
];
