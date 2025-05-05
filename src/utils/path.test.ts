import path from 'path';
import { resolvePackagePath, DEFAULT_CONFIG_PATH } from './path.js';
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
