import * as fs from 'fs';
import * as path from 'path';
import { resolvePackagePath, DEFAULT_CONFIG_PATH } from './path.js';
import { walkUpDirectories } from './path.js';
import { walkUpDirectoriesAsync } from './path.js';
import { findPackageRoot } from './path.js';
import { findProjectRootByLockFiles } from './path.js';
import { isDirectoryPackage } from './path.js';
import { findPackageByName } from './path.js';
import { isCurrentDirectorySaikiProject } from './path.js';
import { findSaikiProjectRoot } from './path.js';
import { describe, it, expect } from 'vitest';

describe('resolvePackagePath', () => {
    it('returns the same path when given an absolute path', () => {
        const absolute = '/tmp/some/path';
        expect(resolvePackagePath(absolute, false)).toBe(absolute);
    });

    it('resolves a relative path against process.cwd when resolveFromPackageRoot is false', () => {
        const relative = 'some/relative/path';
        const expected = path.resolve(process.cwd(), relative);
        expect(resolvePackagePath(relative, false)).toBe(expected);
    });

    it('resolves the default config path from the package root when resolveFromPackageRoot is true', () => {
        const resolved = resolvePackagePath(DEFAULT_CONFIG_PATH, true);
        const expected = path.resolve(process.cwd(), DEFAULT_CONFIG_PATH);
        expect(resolved).toBe(expected);
    });
});

describe('walkUpDirectories', () => {
    it('returns null when no directories match the predicate', () => {
        const result = walkUpDirectories('/tmp', (dirPath) => dirPath === '/not/a/match');
        expect(result).toBeNull();
    });

    it('returns the first directory that matches the predicate', () => {
        const result = walkUpDirectories('/tmp', (dirPath) => dirPath.includes('tmp'));
        expect(result).toBe('/tmp');
    });
});

describe('walkUpDirectoriesAsync', () => {
    it('returns null if async predicate never matches', async () => {
        const result = await walkUpDirectoriesAsync(process.cwd(), async () => false);
        expect(result).toBeNull();
    });

    it('returns startPath if async predicate matches immediately', async () => {
        const start = process.cwd();
        const result = await walkUpDirectoriesAsync(start, async (dir) => dir === start);
        expect(result).toBe(start);
    });
});

describe('findPackageRoot', () => {
    it('returns null if no package.json found', () => {
        const result = findPackageRoot('/tmp');
        expect(result).toBeNull();
    });

    it('returns the directory containing package.json', () => {
        const result = findPackageRoot(process.cwd());
        expect(result).toBe(process.cwd());
    });
});

describe('findProjectRootByLockFiles', () => {
    it('returns null if no lock file found', () => {
        const result = findProjectRootByLockFiles('/tmp');
        expect(result).toBeNull();
    });

    it('returns the directory containing package-lock.json', () => {
        const result = findProjectRootByLockFiles(process.cwd());
        expect(result).toBe(process.cwd());
    });
});

describe('isDirectoryPackage', () => {
    const tmpDir = path.join(process.cwd(), 'tmp_test_dir');
    const malformedJsonDir = path.join(tmpDir, 'malformed');
    const missingNameDir = path.join(tmpDir, 'missingName');
    const permissionErrorDir = path.join(tmpDir, 'permissionError');

    beforeAll(() => {
        fs.mkdirSync(tmpDir, { recursive: true });

        // Malformed JSON
        fs.mkdirSync(malformedJsonDir, { recursive: true });
        fs.writeFileSync(path.join(malformedJsonDir, 'package.json'), '{ invalid json }');

        // Missing name field
        fs.mkdirSync(missingNameDir, { recursive: true });
        fs.writeFileSync(
            path.join(missingNameDir, 'package.json'),
            JSON.stringify({ version: '1.0.0' })
        );

        // Permission error
        fs.mkdirSync(permissionErrorDir, { recursive: true });
        fs.writeFileSync(
            path.join(permissionErrorDir, 'package.json'),
            JSON.stringify({ name: 'test-package' })
        );
        fs.chmodSync(path.join(permissionErrorDir, 'package.json'), 0); // Remove all permissions
    });

    afterAll(() => {
        // Restore permissions before cleanup
        try {
            fs.chmodSync(path.join(permissionErrorDir, 'package.json'), 0o644);
        } catch {}
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('returns false for malformed package.json', async () => {
        const result = await isDirectoryPackage(malformedJsonDir, 'test-package');
        expect(result).toBe(false);
    });

    it('returns false when package.json lacks name field', async () => {
        const result = await isDirectoryPackage(missingNameDir, 'test-package');
        expect(result).toBe(false);
    });

    it('returns false when file permission error prevents reading package.json', async () => {
        const result = await isDirectoryPackage(permissionErrorDir, 'test-package');
        expect(result).toBe(false);
    });
});

describe('findPackageByName', () => {
    it('returns null if package not found', async () => {
        const result = await findPackageByName('non-existent-package', '/tmp');
        expect(result).toBeNull();
    });

    it('returns the package path if found', async () => {
        const result = await findPackageByName('@truffle-ai/saiki', process.cwd());
        expect(result).toBe(process.cwd());
    });
});

describe('isCurrentDirectorySaikiProject', () => {
    it('returns false if not in a Saiki project', async () => {
        const result = await isCurrentDirectorySaikiProject('/tmp');
        expect(result).toBe(false);
    });

    it('returns true if in a Saiki project', async () => {
        const result = await isCurrentDirectorySaikiProject(process.cwd());
        expect(result).toBe(true);
    });
});

describe('findSaikiProjectRoot', () => {
    it('returns null if not in a Saiki project', async () => {
        const result = await findSaikiProjectRoot('/tmp');
        expect(result).toBeNull();
    });

    it('returns the Saiki project root if found', async () => {
        const result = await findSaikiProjectRoot(process.cwd());
        expect(result).toBe(process.cwd());
    });
});
