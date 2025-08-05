import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir, homedir } from 'os';
import {
    updateProjectEnvFileWithLLMKeys,
    updateDetectedEnvFileWithLLMKeys,
} from './api-key-utils.js';

// Mock homedir to control global .dexto location
vi.mock('os', async () => {
    const actual = await vi.importActual('os');
    return {
        ...actual,
        homedir: vi.fn(),
    };
});

describe('API Key Utils', () => {
    let tempDir: string;
    let mockHomeDir: string;

    beforeEach(async () => {
        // Create a temporary directory for testing
        tempDir = await fs.mkdtemp(path.join(tmpdir(), 'dexto-api-key-test-'));

        // Create mock home directory
        mockHomeDir = await fs.mkdtemp(path.join(tmpdir(), 'dexto-mock-home-'));

        // Mock homedir to return our test directory
        vi.mocked(homedir).mockReturnValue(mockHomeDir);
    });

    afterEach(async () => {
        // Cleanup the temporary directories
        await fs.rm(tempDir, { recursive: true, force: true });
        await fs.rm(mockHomeDir, { recursive: true, force: true });

        vi.clearAllMocks();
    });

    describe('updateProjectEnvFileWithLLMKeys', () => {
        it('creates a new .env file with the Dexto env section when none exists', async () => {
            await updateProjectEnvFileWithLLMKeys(tempDir, 'openai', 'key1');
            const result = await fs.readFile(path.join(tempDir, '.env'), 'utf8');
            const expected = [
                '',
                '## Dexto env variables',
                'OPENAI_API_KEY=key1',
                'ANTHROPIC_API_KEY=',
                'GOOGLE_GENERATIVE_AI_API_KEY=',
                'GROQ_API_KEY=',
                'DEXTO_LOG_LEVEL=info',
                '',
            ].join('\n');
            expect(result).toBe(expected);
        });

        it('updates existing .env preserving unrelated lines and replacing Dexto section', async () => {
            // Prepare an existing .env with unrelated and old Dexto section
            const initial = [
                'FOO=bar',
                'BAZ=qux',
                '',
                '## Dexto env variables',
                'OPENAI_API_KEY=oldKey',
                'ANTHROPIC_API_KEY=oldAnth',
                '',
                'OTHER=123',
                '',
            ].join('\n');
            await fs.writeFile(path.join(tempDir, '.env'), initial, 'utf8');

            await updateProjectEnvFileWithLLMKeys(tempDir, 'anthropic', 'newAnthKey');
            const result = await fs.readFile(path.join(tempDir, '.env'), 'utf8');

            const expected = [
                'FOO=bar',
                'BAZ=qux',
                '',
                'OTHER=123',
                '',
                '## Dexto env variables',
                'OPENAI_API_KEY=oldKey',
                'ANTHROPIC_API_KEY=newAnthKey',
                'GOOGLE_GENERATIVE_AI_API_KEY=',
                'GROQ_API_KEY=',
                'DEXTO_LOG_LEVEL=info',
                '',
            ].join('\n');
            expect(result).toBe(expected);
        });

        it('preserves existing keys in non-Dexto section when updating', async () => {
            const initial = ['OPENAI_API_KEY=foo', 'OTHER=1', ''].join('\n');
            await fs.writeFile(path.join(tempDir, '.env'), initial, 'utf8');

            await updateProjectEnvFileWithLLMKeys(tempDir, 'google', 'gkey');
            const result = await fs.readFile(path.join(tempDir, '.env'), 'utf8');
            const expected = [
                'OPENAI_API_KEY=foo',
                'OTHER=1',
                '',
                '## Dexto env variables',
                'ANTHROPIC_API_KEY=',
                'GOOGLE_GENERATIVE_AI_API_KEY=gkey',
                'GROQ_API_KEY=',
                'DEXTO_LOG_LEVEL=info',
                '',
            ].join('\n');
            expect(result).toBe(expected);
        });

        it('adds empty entries for keys not passed and not originally present', async () => {
            // No initial .env file, no keys passed
            await updateProjectEnvFileWithLLMKeys(tempDir);
            const result = await fs.readFile(path.join(tempDir, '.env'), 'utf8');
            const expected = [
                '',
                '## Dexto env variables',
                'OPENAI_API_KEY=',
                'ANTHROPIC_API_KEY=',
                'GOOGLE_GENERATIVE_AI_API_KEY=',
                'GROQ_API_KEY=',
                'DEXTO_LOG_LEVEL=info',
                '',
            ].join('\n');
            expect(result).toBe(expected);
        });

        it('updates specific provider key while preserving others', async () => {
            const initial = ['OPENAI_API_KEY=foo', 'OTHER=1', ''].join('\n');
            await fs.writeFile(path.join(tempDir, '.env'), initial, 'utf8');

            await updateProjectEnvFileWithLLMKeys(tempDir, 'openai', 'bar');
            const result = await fs.readFile(path.join(tempDir, '.env'), 'utf8');
            const expected = [
                'OPENAI_API_KEY=foo',
                'OTHER=1',
                '',
                '## Dexto env variables',
                'OPENAI_API_KEY=bar',
                'ANTHROPIC_API_KEY=',
                'GOOGLE_GENERATIVE_AI_API_KEY=',
                'GROQ_API_KEY=',
                'DEXTO_LOG_LEVEL=info',
                '',
            ].join('\n');
            expect(result).toBe(expected);
        });

        it('handles multiple providers correctly', async () => {
            // First add openai key
            await updateProjectEnvFileWithLLMKeys(tempDir, 'openai', 'openai-key');

            // Then add anthropic key
            await updateProjectEnvFileWithLLMKeys(tempDir, 'anthropic', 'anthropic-key');

            const result = await fs.readFile(path.join(tempDir, '.env'), 'utf8');
            const expected = [
                '',
                '## Dexto env variables',
                'OPENAI_API_KEY=openai-key',
                'ANTHROPIC_API_KEY=anthropic-key',
                'GOOGLE_GENERATIVE_AI_API_KEY=',
                'GROQ_API_KEY=',
                'DEXTO_LOG_LEVEL=info',
                '',
            ].join('\n');
            expect(result).toBe(expected);
        });
    });

    describe('updateDetectedEnvFileWithLLMKeys', () => {
        it('uses project .env when in dexto project', async () => {
            // Create a package.json with dexto dependency to make it a dexto project
            await fs.writeFile(
                path.join(tempDir, 'package.json'),
                JSON.stringify({ dependencies: { dexto: '^1.0.0' } })
            );

            await updateDetectedEnvFileWithLLMKeys(tempDir, 'openai', 'project-key');

            // Should write to project .env
            const result = await fs.readFile(path.join(tempDir, '.env'), 'utf8');
            expect(result).toContain('OPENAI_API_KEY=project-key');
        });

        it('uses global ~/.dexto/.env when not in dexto project', async () => {
            // Don't create package.json with dexto dependency - not a dexto project

            // This should write to global ~/.dexto/.env instead of project .env
            await updateDetectedEnvFileWithLLMKeys(tempDir, 'openai', 'global-key');

            // Project .env should not exist
            const projectEnvExists = await fs
                .access(path.join(tempDir, '.env'))
                .then(() => true)
                .catch(() => false);
            expect(projectEnvExists).toBe(false);

            // Global ~/.dexto/.env should exist in mocked home directory
            const globalEnvPath = path.join(mockHomeDir, '.dexto', '.env');
            const globalEnvExists = await fs
                .access(globalEnvPath)
                .then(() => true)
                .catch(() => false);
            expect(globalEnvExists).toBe(true);

            // Verify the content was written correctly
            const globalEnvContent = await fs.readFile(globalEnvPath, 'utf8');
            expect(globalEnvContent).toContain('OPENAI_API_KEY=global-key');
        });
    });
});
