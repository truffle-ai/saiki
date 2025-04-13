import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
// It's often helpful to import the 'globals' package for standard environments
// import globals from 'globals'; // npm install --save-dev globals

export default [
    // Base config for all files
    js.configs.recommended,
    {
        linterOptions: {
            reportUnusedDisableDirectives: 'warn',
        }
    },

    // TypeScript specific config
    {
        files: ['**/*.ts'],
        languageOptions: {
            parser: tsParser,
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                // Define Node.js globals for TS files if needed (adjust as necessary)
                console: 'readonly',
                process: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                global: 'readonly',
                require: 'readonly',
                __dirname: 'readonly',
                module: 'readonly',
                Buffer: 'readonly',
                URL: 'readonly'
                // Remove browser globals if they are not used in your TS files
                // document: 'readonly', 
                // window: 'readonly',
            },
        },
        plugins: {
            '@typescript-eslint': tseslint,
        },
        rules: {
             // Keep your TS specific rules
            'no-console': 'off', // Example rule adjustment for TS
            'no-unused-vars': 'off', // Base rule off, TS rule handles it
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        },
    },

    // JavaScript Client-side specific config
    {
        files: ["app/web/client/script.js"], // Make the path specific
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                // Define Browser globals
                window: 'readonly',
                document: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly', // Added clearTimeout
                WebSocket: 'readonly',
                // Add other browser APIs you use e.g.:
                // fetch: 'readonly',
                // localStorage: 'readonly',
                // navigator: 'readonly',
            },
        },
        rules: {
             // Add any JS specific rules if needed, otherwise inherit from recommended
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }], // Example JS rule
            // Disable no-undef specifically for this block if necessary, 
            // but defining globals is preferred.
            // 'no-undef': 'off' 
        }
    },

    // Ignore patterns (keep existing ignores)
    {
        ignores: [
            'node_modules/**',
            'dist/**',
            '.cursor/**',
            'src/servers/**',
            'public/**' // Add public directory to ignores
        ],
    },

    // Prettier config should usually be last
    prettier,
];
