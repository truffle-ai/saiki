import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { updateEnvFile } from './init.js';

describe('updateEnvFile', () => {
    let tempDir: string;

    beforeEach(async () => {
        // Create a temporary directory for testing
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'saiki-test-'));
        // Create a dummy lock file so findProjectRoot locates the tempDir
        await fs.writeFile(path.join(tempDir, 'package-lock.json'), '');
    });

    afterEach(async () => {
        // Cleanup the temporary directory
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('creates a new .env file with the Saiki env section when none exists', async () => {
        await updateEnvFile(tempDir, 'openai', 'key1');
        const result = await fs.readFile(path.join(tempDir, '.env'), 'utf8');
        const expected = [
            '',
            '## Saiki env variables',
            'OPENAI_API_KEY=key1',
            'ANTHROPIC_API_KEY=',
            'GOOGLE_GENERATIVE_AI_API_KEY=',
            'GROK_API_KEY=',
            'SAIKI_LOG_LEVEL=info',
            '',
        ].join('\n');
        expect(result).toBe(expected);
    });

    it('updates existing .env preserving unrelated lines and replacing Saiki section', async () => {
        // Prepare an existing .env with unrelated and old Saiki section
        const initial = [
            'FOO=bar',
            'BAZ=qux',
            '',
            '## Saiki env variables',
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
            '## Saiki env variables',
            'OPENAI_API_KEY=oldKey',
            'ANTHROPIC_API_KEY=newAnthKey',
            'GOOGLE_GENERATIVE_AI_API_KEY=',
            'GROK_API_KEY=',
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

    // Case 1: key exists and not passed -> skip it in Saiki section
    it('skips keys originally present and not passed', async () => {
        const initial = ['OPENAI_API_KEY=foo', 'OTHER=1', ''].join('\n');
        await fs.writeFile(path.join(tempDir, '.env'), initial, 'utf8');

        await updateEnvFile(tempDir);
        const result = await fs.readFile(path.join(tempDir, '.env'), 'utf8');
        const expected = [
            'OPENAI_API_KEY=foo',
            'OTHER=1',
            '',
            '## Saiki env variables',
            'ANTHROPIC_API_KEY=',
            'GOOGLE_GENERATIVE_AI_API_KEY=',
            'GROK_API_KEY=',
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
            '## Saiki env variables',
            'OPENAI_API_KEY=',
            'ANTHROPIC_API_KEY=',
            'GOOGLE_GENERATIVE_AI_API_KEY=gkey',
            'GROK_API_KEY=',
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
            '## Saiki env variables',
            'OPENAI_API_KEY=',
            'ANTHROPIC_API_KEY=',
            'GOOGLE_GENERATIVE_AI_API_KEY=',
            'GROK_API_KEY=',
            'SAIKI_LOG_LEVEL=info',
            '',
        ].join('\n');
        expect(result).toBe(expected);
    });

    // Case 4: key exists and is passed -> override in Saiki section, keep old value
    it('overrides originally present key when passed', async () => {
        const initial = ['OPENAI_API_KEY=foo', 'OTHER=1', ''].join('\n');
        await fs.writeFile(path.join(tempDir, '.env'), initial, 'utf8');

        await updateEnvFile(tempDir, 'openai', 'bar');
        const result = await fs.readFile(path.join(tempDir, '.env'), 'utf8');
        const expected = [
            'OPENAI_API_KEY=foo',
            'OTHER=1',
            '',
            '## Saiki env variables',
            'OPENAI_API_KEY=bar',
            'ANTHROPIC_API_KEY=',
            'GOOGLE_GENERATIVE_AI_API_KEY=',
            'GROK_API_KEY=',
            'SAIKI_LOG_LEVEL=info',
            '',
        ].join('\n');
        expect(result).toBe(expected);
    });
});
