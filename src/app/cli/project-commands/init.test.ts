import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { updateEnvFile } from './init.js';

describe('updateEnvFile', () => {
    let tempDir: string;

    beforeEach(async () => {
        // Create a temporary directory for testing
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dexto-test-'));
        // Create a dummy package.json file so findPackageRoot locates the tempDir
        await fs.writeFile(path.join(tempDir, 'package.json'), '{}');
    });

    afterEach(async () => {
        // Cleanup the temporary directory
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('creates a new .env file with the Dexto env section when none exists', async () => {
        await updateEnvFile(tempDir, 'openai', 'key1');
        const result = await fs.readFile(path.join(tempDir, '.env'), 'utf8');
        const expected = [
            '',
            '## Dexto env variables',
            'OPENAI_API_KEY=key1',
            'ANTHROPIC_API_KEY=',
            'GOOGLE_GENERATIVE_AI_API_KEY=',
            'GROQ_API_KEY=',
            'SAIKI_LOG_LEVEL=info',
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

        await updateEnvFile(tempDir, 'anthropic', 'newAnthKey');
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
            'SAIKI_LOG_LEVEL=info',
            '',
        ].join('\n');
        expect(result).toBe(expected);
    });

    it('throws if project root cannot be found', async () => {
        // Use a directory without a lock file
        const noLockDir = path.join(os.tmpdir(), 'no-lock-dir');
        await fs.mkdir(noLockDir, { recursive: true });
        await expect(updateEnvFile(noLockDir, 'openai', 'key')).rejects.toThrow(
            'Could not find project root'
        );
        await fs.rm(noLockDir, { recursive: true, force: true });
    });

    // Case 1: key exists and not passed -> skip it in Dexto section
    it('skips keys originally present and not passed', async () => {
        const initial = ['OPENAI_API_KEY=foo', 'OTHER=1', ''].join('\n');
        await fs.writeFile(path.join(tempDir, '.env'), initial, 'utf8');

        await updateEnvFile(tempDir);
        const result = await fs.readFile(path.join(tempDir, '.env'), 'utf8');
        const expected = [
            'OPENAI_API_KEY=foo',
            'OTHER=1',
            '',
            '## Dexto env variables',
            'ANTHROPIC_API_KEY=',
            'GOOGLE_GENERATIVE_AI_API_KEY=',
            'GROQ_API_KEY=',
            'SAIKI_LOG_LEVEL=info',
            '',
        ].join('\n');
        expect(result).toBe(expected);
    });

    // Case 2: key does not exist and is passed -> add it
    it('adds new key when it does not exist and is passed', async () => {
        const initial = ['FOO=bar', ''].join('\n');
        await fs.writeFile(path.join(tempDir, '.env'), initial, 'utf8');

        await updateEnvFile(tempDir, 'google', 'gkey');
        const result = await fs.readFile(path.join(tempDir, '.env'), 'utf8');
        const expected = [
            'FOO=bar',
            '',
            '## Dexto env variables',
            'OPENAI_API_KEY=',
            'ANTHROPIC_API_KEY=',
            'GOOGLE_GENERATIVE_AI_API_KEY=gkey',
            'GROQ_API_KEY=',
            'SAIKI_LOG_LEVEL=info',
            '',
        ].join('\n');
        expect(result).toBe(expected);
    });

    // Case 3: key does not exist and not passed -> add empty entry
    it('adds empty entries for keys not passed and not originally present', async () => {
        // No initial .env file
        await updateEnvFile(tempDir);
        const result = await fs.readFile(path.join(tempDir, '.env'), 'utf8');
        const expected = [
            '',
            '## Dexto env variables',
            'OPENAI_API_KEY=',
            'ANTHROPIC_API_KEY=',
            'GOOGLE_GENERATIVE_AI_API_KEY=',
            'GROQ_API_KEY=',
            'SAIKI_LOG_LEVEL=info',
            '',
        ].join('\n');
        expect(result).toBe(expected);
    });

    // Case 4: key exists and is passed -> override in Dexto section, keep old value
    it('overrides originally present key when passed', async () => {
        const initial = ['OPENAI_API_KEY=foo', 'OTHER=1', ''].join('\n');
        await fs.writeFile(path.join(tempDir, '.env'), initial, 'utf8');

        await updateEnvFile(tempDir, 'openai', 'bar');
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
            'SAIKI_LOG_LEVEL=info',
            '',
        ].join('\n');
        expect(result).toBe(expected);
    });

    it('works when called with project root instead of non-existent subdirectory', async () => {
        // This simulates the init-app scenario where we call updateEnvFile with
        // the current working directory (project root) instead of a subdirectory
        // that might not exist yet (like "src/")

        // The tempDir already has a lock file from beforeEach
        await updateEnvFile(tempDir, 'anthropic', 'test-key');
        const result = await fs.readFile(path.join(tempDir, '.env'), 'utf8');

        const expected = [
            '',
            '## Dexto env variables',
            'OPENAI_API_KEY=',
            'ANTHROPIC_API_KEY=test-key',
            'GOOGLE_GENERATIVE_AI_API_KEY=',
            'GROQ_API_KEY=',
            'SAIKI_LOG_LEVEL=info',
            '',
        ].join('\n');
        expect(result).toBe(expected);
    });
});
