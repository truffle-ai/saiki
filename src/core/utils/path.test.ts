import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { resolvePackagePath, DEFAULT_CONFIG_PATH } from './path.js';
import { walkUpDirectories } from './path.js';
import { findPackageRoot } from './path.js';
import { findProjectRootByLockFiles } from './path.js';
import { isDirectoryPackage } from './path.js';
import { findPackageByName } from './path.js';
import { isDextoProject } from './path.js';
import { findDextoProjectRoot } from './path.js';
import { resolveDextoLogPath } from './path.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

function createTempDir() {
    return fs.mkdtempSync(path.join(tmpdir(), 'dexto-test-'));
}

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

describe('findPackageRoot', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = createTempDir();
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('returns null if no package.json found', () => {
        const result = findPackageRoot(tempDir);
        expect(result).toBeNull();
    });

    it('returns the directory containing package.json', () => {
        fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test-pkg' }));
        const result = findPackageRoot(tempDir);
        expect(result).toBe(tempDir);
    });
});

describe('findProjectRootByLockFiles', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = createTempDir();
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('returns null if no lock file found', () => {
        const result = findProjectRootByLockFiles(tempDir);
        expect(result).toBeNull();
    });

    it('returns the directory containing package-lock.json', () => {
        fs.writeFileSync(path.join(tempDir, 'package-lock.json'), '{}');
        const result = findProjectRootByLockFiles(tempDir);
        expect(result).toBe(tempDir);
    });
});

describe('isDirectoryPackage', () => {
    let tempDir: string;

    beforeEach(() => {
        tempDir = createTempDir();
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('returns false if package.json does not exist', () => {
        const result = isDirectoryPackage(tempDir, 'some-package');
        expect(result).toBe(false);
    });

    it('returns true if package.json exists in the directory', () => {
        fs.writeFileSync(
            path.join(tempDir, 'package.json'),
            JSON.stringify({ name: 'some-package' })
        );
        const result = isDirectoryPackage(tempDir, 'some-package');
        expect(result).toBe(true);
    });
});

describe('findPackageByName', () => {
    it('returns null if package not found', () => {
        const result = findPackageByName('non-existent-package', '/tmp');
        expect(result).toBeNull();
    });

    it('returns the package path if found', () => {
        const result = findPackageByName('@truffle-ai/saiki', process.cwd());
        expect(result).toBe(process.cwd());
    });
});

describe('isDextoProject', () => {
    it('returns false if not in a Dexto project', () => {
        const result = isDextoProject('/tmp');
        expect(result).toBe(false);
    });

    it('returns true if in a Dexto project', () => {
        const result = isDextoProject(process.cwd());
        expect(result).toBe(true);
    });
});

describe('findDextoProjectRoot', () => {
    it('returns null if not in a Dexto project', () => {
        const result = findDextoProjectRoot('/tmp');
        expect(result).toBeNull();
    });

    it('returns the Dexto project root if found', () => {
        const result = findDextoProjectRoot(process.cwd());
        expect(result).toBe(process.cwd());
    });
});

describe('resolveDextoLogPath', () => {
    it('resolves to local project .dexto/logs when in a Dexto project', () => {
        // We're in a Dexto project (has agents/agent.yml)
        const result = resolveDextoLogPath();
        expect(result).toBe(path.join(process.cwd(), '.dexto', 'logs', 'dexto.log'));
    });

    it('accepts custom log file name', () => {
        const result = resolveDextoLogPath('custom.log');
        expect(result).toBe(path.join(process.cwd(), '.dexto', 'logs', 'custom.log'));
    });
});
