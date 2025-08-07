import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { loadAgentConfig } from './loader.js';
import { ConfigErrorCode, ErrorScope, ErrorType } from '@core/errors/index.js';

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
    it('loads raw config without expanding environment variables', async () => {
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
        // Config loader no longer expands env vars - Zod schema handles it
        expect(config.llm?.temperature).toBe('${TEST_VAR}');
        expect(config.llm?.maxOutputTokens).toBe('${MAX_TOKENS}');
    });

    it('throws DextoRuntimeError with file not found code when file does not exist', async () => {
        const missing = path.resolve(process.cwd(), 'nonexistent.yml');
        await expect(loadAgentConfig(missing)).rejects.toThrow(
            expect.objectContaining({
                code: ConfigErrorCode.FILE_NOT_FOUND,
                scope: ErrorScope.CONFIG,
                type: ErrorType.USER,
            })
        );
    });

    it('throws DextoRuntimeError with file read error code when file cannot be read', async () => {
        await fs.writeFile(tmpFile, 'some content', { mode: 0o000 });
        await expect(loadAgentConfig(tmpFile)).rejects.toThrow(
            expect.objectContaining({
                code: ConfigErrorCode.FILE_READ_ERROR,
                scope: ErrorScope.CONFIG,
                type: ErrorType.SYSTEM,
            })
        );
        await fs.unlink(tmpFile);
    });

    it('throws DextoRuntimeError with parse error code when file content is invalid YAML', async () => {
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
        await expect(loadAgentConfig(tmpFile)).rejects.toThrow(
            expect.objectContaining({
                code: ConfigErrorCode.PARSE_ERROR,
                scope: ErrorScope.CONFIG,
                type: ErrorType.USER,
            })
        );
    });

    it('throws file not found error when no default config exists', async () => {
        // Test with a non-existent path to ensure predictable behavior
        const nonExistentPath = '/tmp/definitely-does-not-exist/agent.yml';
        await expect(loadAgentConfig(nonExistentPath)).rejects.toThrow(
            expect.objectContaining({
                code: ConfigErrorCode.FILE_NOT_FOUND,
                scope: ErrorScope.CONFIG,
                type: ErrorType.USER,
            })
        );
    });

    it('loads config with undefined environment variables as raw strings', async () => {
        const yamlContent = `
llm:
  provider: 'test-provider'
  model: 'test-model'
  apiKey: \${UNDEFINED_API_KEY} # This variable is intentionally not set
mcpServers:
  testServer:
    type: 'stdio'
    command: 'echo'
    args: ['hello']
`;
        await fs.writeFile(tmpFile, yamlContent);

        delete process.env.UNDEFINED_API_KEY;

        // Should not throw - env var expansion now handled by Zod schema
        const config = await loadAgentConfig(tmpFile);
        expect(config.llm?.apiKey).toBe('${UNDEFINED_API_KEY}');
    });
});
