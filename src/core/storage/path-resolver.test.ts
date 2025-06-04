import { StoragePathResolver } from './path-resolver.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { homedir } from 'os';
import * as path from 'path';
import { promises as fs } from 'fs';

// Mock the path utilities
vi.mock('../utils/path.js', () => ({
    isCurrentDirectorySaikiProject: vi.fn(),
    findSaikiProjectRoot: vi.fn(),
    findSaikiProjectRootEnhanced: vi.fn(),
    isGlobalInstall: vi.fn(),
    isSaikiProject: vi.fn(),
}));

// Mock fs for testing
vi.mock('fs', () => ({
    promises: {
        access: vi.fn(),
        mkdir: vi.fn(),
    },
}));

import {
    isCurrentDirectorySaikiProject,
    findSaikiProjectRoot,
    findSaikiProjectRootEnhanced,
    isGlobalInstall,
    isSaikiProject,
} from '../utils/path.js';

const mockIsCurrentDirectorySaikiProject = vi.mocked(isCurrentDirectorySaikiProject);
const mockFindSaikiProjectRoot = vi.mocked(findSaikiProjectRoot);
const mockFindSaikiProjectRootEnhanced = vi.mocked(findSaikiProjectRootEnhanced);
const mockIsGlobalInstall = vi.mocked(isGlobalInstall);
const mockIsSaikiProject = vi.mocked(isSaikiProject);
const mockFs = vi.mocked(fs);

describe('StoragePathResolver', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset environment variables
        delete process.env.SAIKI_FORCE_GLOBAL_STORAGE;
        delete process.env.SAIKI_FORCE_LOCAL_STORAGE;

        // Default mock implementations
        mockFs.access.mockResolvedValue(undefined);
        mockFs.mkdir.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createLocalContext', () => {
        it('should create context with project root when in Saiki project', async () => {
            const projectRoot = '/path/to/saiki';
            mockFindSaikiProjectRootEnhanced.mockResolvedValue(projectRoot);

            const context = await StoragePathResolver.createLocalContext({
                projectRoot,
            });

            expect(context).toEqual({
                isDevelopment: true, // NODE_ENV !== 'production'
                projectRoot,
                forceGlobal: false,
                customRoot: undefined,
            });
        });

        it('should fall back to global when projectRoot is not a Saiki project', async () => {
            mockFindSaikiProjectRootEnhanced.mockResolvedValue(null);

            const context = await StoragePathResolver.createLocalContext({
                projectRoot: '/some/other/project',
            });

            expect(context).toEqual({
                isDevelopment: true,
                projectRoot: undefined,
                forceGlobal: false,
                customRoot: undefined,
            });
        });

        it('should respect forceGlobal option', async () => {
            const context = await StoragePathResolver.createLocalContext({
                forceGlobal: true,
            });

            expect(context.forceGlobal).toBe(true);
            expect(mockFindSaikiProjectRootEnhanced).not.toHaveBeenCalled();
        });
    });

    describe('createLocalContextWithAutoDetection', () => {
        it('should use global storage when SAIKI_FORCE_GLOBAL_STORAGE is set', async () => {
            process.env.SAIKI_FORCE_GLOBAL_STORAGE = 'true';

            const context = await StoragePathResolver.createLocalContextWithAutoDetection();

            expect(context.forceGlobal).toBe(true);
            expect(mockIsGlobalInstall).not.toHaveBeenCalled();
        });

        it('should use local storage when SAIKI_FORCE_LOCAL_STORAGE is set', async () => {
            process.env.SAIKI_FORCE_LOCAL_STORAGE = 'true';
            mockFindSaikiProjectRootEnhanced.mockResolvedValue('/path/to/saiki');

            const context = await StoragePathResolver.createLocalContextWithAutoDetection();

            expect(context.forceGlobal).toBe(false);
            expect(mockIsGlobalInstall).not.toHaveBeenCalled();
        });

        it('should auto-detect global install when no env vars set', async () => {
            mockIsGlobalInstall.mockResolvedValue(true);

            const context = await StoragePathResolver.createLocalContextWithAutoDetection();

            expect(context.forceGlobal).toBe(true);
            expect(mockIsGlobalInstall).toHaveBeenCalled();
        });

        it('should auto-detect local install when no env vars set', async () => {
            mockIsGlobalInstall.mockResolvedValue(false);
            mockFindSaikiProjectRootEnhanced.mockResolvedValue('/path/to/saiki');

            const context = await StoragePathResolver.createLocalContextWithAutoDetection();

            expect(context.forceGlobal).toBe(false);
            expect(mockIsGlobalInstall).toHaveBeenCalled();
        });
    });

    describe('resolveStorageRoot', () => {
        it('should use custom root when provided', async () => {
            const customRoot = '/custom/storage';
            const context = {
                customRoot,
                isDevelopment: false,
                forceGlobal: false,
            };

            // Mock that directory doesn't exist, so mkdir will be called
            mockFs.access.mockRejectedValue(new Error('ENOENT'));

            const result = await StoragePathResolver.resolveStorageRoot(context);

            expect(result).toBe(customRoot);
            expect(mockFs.access).toHaveBeenCalledWith(customRoot);
            expect(mockFs.mkdir).toHaveBeenCalledWith(customRoot, { recursive: true });
        });

        it('should use global storage when forceGlobal is true', async () => {
            const context = {
                forceGlobal: true,
                isDevelopment: false,
            };

            const result = await StoragePathResolver.resolveStorageRoot(context);

            const expectedPath = path.join(homedir(), '.saiki');
            expect(result).toBe(expectedPath);
        });

        it('should use project-local storage when projectRoot is provided', async () => {
            const projectRoot = '/path/to/project';
            const context = {
                projectRoot,
                isDevelopment: false,
                forceGlobal: false,
            };

            const result = await StoragePathResolver.resolveStorageRoot(context);

            const expectedPath = path.join(projectRoot, '.saiki');
            expect(result).toBe(expectedPath);
        });

        it('should fall back to global storage when no projectRoot', async () => {
            const context = {
                isDevelopment: false,
                forceGlobal: false,
            };

            const result = await StoragePathResolver.resolveStorageRoot(context);

            const expectedPath = path.join(homedir(), '.saiki');
            expect(result).toBe(expectedPath);
        });
    });

    describe('ensureDirectory', () => {
        it('should not create directory if it exists', async () => {
            mockFs.access.mockResolvedValue(undefined);

            await StoragePathResolver.ensureDirectory('/existing/path');

            expect(mockFs.access).toHaveBeenCalledWith('/existing/path');
            expect(mockFs.mkdir).not.toHaveBeenCalled();
        });

        it('should create directory if it does not exist', async () => {
            mockFs.access.mockRejectedValue(new Error('ENOENT'));

            await StoragePathResolver.ensureDirectory('/new/path');

            expect(mockFs.access).toHaveBeenCalledWith('/new/path');
            expect(mockFs.mkdir).toHaveBeenCalledWith('/new/path', { recursive: true });
        });
    });
});
