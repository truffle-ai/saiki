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
        esbuildOptions(options, ctx) {
            // Disable bundling for ESM output
            if (ctx.format === 'esm') {
                options.bundle = false;
            }
        },
    },
    // App entry: only ESM, no bundling needed
    {
        entry: ['src/app/index.ts'],
        format: ['esm'],
        outDir: 'dist/src/app',
        shims: true,
    },
]);
