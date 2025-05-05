import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { loadConfigFile } from './loader.js';

// Use a temp file next to the loader file
const tmpFile = path.resolve(process.cwd(), 'src/config/temp-config.yml');

beforeEach(async () => {
    delete process.env.TEST_VAR;
    // Clean up before test
    try {
        await fs.unlink(tmpFile);
    } catch {
        /* ignore error if file does not exist */
    }
});

afterEach(async () => {
    delete process.env.TEST_VAR;
    try {
        await fs.unlink(tmpFile);
    } catch {
        /* ignore error if file does not exist */
    }
});

describe('loadConfigFile', () => {
    it('loads and expands environment variables in YAML', async () => {
        process.env.TEST_VAR = 'value';
        const yamlContent = 'foo: $TEST_VAR\nnested:\n  bar: ${TEST_VAR}';
        await fs.writeFile(tmpFile, yamlContent);

        const config = await loadConfigFile(tmpFile);
        expect(config.foo).toBe('value');
        expect(config.nested.bar).toBe('value');
    });

    it('throws error when file cannot be read', async () => {
        const missing = path.resolve(process.cwd(), 'nonexistent.yml');
        await expect(loadConfigFile(missing)).rejects.toThrow(
            /Failed to load config file at .*nonexistent\.yml/
        );
    });
});
