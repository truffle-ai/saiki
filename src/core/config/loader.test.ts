import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ValidationError } from '@core/error/index.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import { loadAgentConfig } from './loader.js';

// Use a temp file next to the loader file
const tmpFile = path.resolve(process.cwd(), 'src/core/config/temp-config.yml');

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

describe('loadAgentConfig', () => {
    it('loads and expands environment variables within LLM configuration in YAML', async () => {
        process.env.TEST_VAR = '0.7';
        process.env.MAX_TOKENS = '4000';
        const yamlContent = `
llm:
  provider: 'test-provider'
  model: 'test-model'
  systemPrompt: 'base-prompt' # Added a base system prompt for completeness
  temperature: \${TEST_VAR}
  maxOutputTokens: \${MAX_TOKENS}
mcpServers:
  testServer: # Added a minimal mcpServers entry for schema validity
    type: 'stdio'
    command: 'echo'
    args: ['hello']
`;
        await fs.writeFile(tmpFile, yamlContent);

        const config = await loadAgentConfig(tmpFile);
        // Access the new explicit fields
        expect(config.llm?.temperature).toBe(0.7);
        expect(config.llm?.maxOutputTokens).toBe(4000);
    });

    it('throws error when file cannot be read', async () => {
        const missing = path.resolve(process.cwd(), 'nonexistent.yml');
        await expect(loadAgentConfig(missing)).rejects.toThrow(
            /Failed to load config file at .*nonexistent\.yml/
        );
    });

    it('loads default config when no path is provided', async () => {
        // This test verifies that loadAgentConfig() works without parameters
        // It will use auto-discovery logic from resolveConfigPath()
        try {
            const config = await loadAgentConfig();
            // Should successfully load a config (either bundled or project-local)
            expect(config).toBeDefined();
            expect(config.llm).toBeDefined();
        } catch (error) {
            // If no default config is found, it should throw a specific error
            expect(error).toBeInstanceOf(ValidationError);
            expect((error as ValidationError).message).toMatch(
                /No agent\.yml found|No bundled config found/
            );
        }
    });
});
