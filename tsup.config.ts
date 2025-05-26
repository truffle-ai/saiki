import { defineConfig } from 'tsup';

export default defineConfig([
    // Core entry: bundle CJS, external ESM
    {
        entry: ['src/core/index.ts'],
        format: ['cjs', 'esm'],
        outDir: 'dist/src/core',
        dts: true,
        shims: true,
        bundle: true,
        noExternal: ['chalk', 'boxen'],
        sourcemap: false
    },
    // App entry: only ESM, no bundling needed
    {
        entry: ['src/app/index.ts'],
        format: ['esm'],
        outDir: 'dist/src/app',
        shims: true,
        sourcemap: false
    },
]);
