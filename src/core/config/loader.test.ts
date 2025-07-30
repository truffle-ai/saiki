import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { loadAgentConfig } from './loader.js';
import {
    ConfigFileNotFoundError,
    ConfigFileReadError,
    ConfigParseError,
    ConfigEnvVarError,
} from '@core/error/index.js';
const tmpFile = path.resolve(process.cwd(), 'src/core/config/temp-config.yml');

beforeEach(async () => {
    delete process.env.TEST_VAR;
    delete process.env.MAX_TOKENS;
    try {
        await fs.unlink(tmpFile);
    } catch {
        /* ignore error if file does not exist */
    }
});

afterEach(async () => {
    delete process.env.TEST_VAR;
    delete process.env.MAX_TOKENS;
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
  systemPrompt: 'base-prompt'
  temperature: \${TEST_VAR}
  maxOutputTokens: \${MAX_TOKENS}
mcpServers:
  testServer:
    type: 'stdio'
    command: 'echo'
    args: ['hello']
`;
        await fs.writeFile(tmpFile, yamlContent);

        const config = await loadAgentConfig(tmpFile);
        expect(config.llm?.temperature).toBe(0.7);
        expect(config.llm?.maxOutputTokens).toBe(4000);
    });

    it('throws ConfigFileNotFoundError when file does not exist', async () => {
        const missing = path.resolve(process.cwd(), 'nonexistent.yml');
        await expect(loadAgentConfig(missing)).rejects.toThrow(ConfigFileNotFoundError);
    });

    it('throws ConfigFileReadError when file cannot be read (e.g., permissions)', async () => {
        await fs.writeFile(tmpFile, 'some content', { mode: 0o000 });
        await expect(loadAgentConfig(tmpFile)).rejects.toThrow(ConfigFileReadError);
        await fs.unlink(tmpFile);
    });

    it('throws ConfigParseError when file content is invalid YAML', async () => {
        const invalidYamlContent = `
llm:
  provider: 'test-provider'
  model: 'test-model'
  temperature: 0.5
    malformed:
mcpServers:
  testServer:
    type: 'stdio'
    command: 'echo'
    args: ['hello']
`;
        await fs.writeFile(tmpFile, invalidYamlContent);
        await expect(loadAgentConfig(tmpFile)).rejects.toThrow(ConfigParseError);
    });

    it('loads default config when no path is provided', async () => {
        try {
            const config = await loadAgentConfig();
            expect(config).toBeDefined();
            expect(config.llm).toBeDefined();
        } catch (error) {
            expect(error).toBeInstanceOf(ConfigFileNotFoundError);
            expect((error as ConfigFileNotFoundError).message).toMatch(
                /Configuration file not found/
            );
        }
    });

    it('throws ConfigEnvVarError when a referenced environment variable is missing', async () => {
        // Define YAML content with a placeholder for a variable that will NOT be set
        const yamlContent = `
llm:
  provider: 'test-provider'
  model: 'test-model'
  api_key: \${UNDEFINED_API_KEY} # This variable is intentionally not set
mcpServers:
  testServer:
    type: 'stdio'
    command: 'echo'
    args: ['hello']
`;
        await fs.writeFile(tmpFile, yamlContent);

        delete process.env.UNDEFINED_API_KEY;

        await expect(loadAgentConfig(tmpFile)).rejects.toThrow(ConfigEnvVarError);
    });
});
