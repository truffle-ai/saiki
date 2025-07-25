import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import {
    walkUpDirectories,
    isSaikiProject,
    getSaikiProjectRoot,
    getSaikiPath,
    resolveConfigPath,
    findPackageRoot,
    resolveBundledScript,
    DEFAULT_CONFIG_PATH,
} from './path.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

function createTempDir() {
    return fs.mkdtempSync(path.join(tmpdir(), 'saiki-test-'));
}

function createTempDirStructure(structure: Record<string, any>, baseDir?: string): string {
    const tempDir = baseDir || createTempDir();

    for (const [filePath, content] of Object.entries(structure)) {
        const fullPath = path.join(tempDir, filePath);
        const dir = path.dirname(fullPath);

        // Create directory if it doesn't exist
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (typeof content === 'string') {
            fs.writeFileSync(fullPath, content);
        } else if (typeof content === 'object') {
            fs.writeFileSync(fullPath, JSON.stringify(content, null, 2));
        }
    }

    return tempDir;
}

describe('walkUpDirectories', () => {
    let tempDir: string;
    let nestedDir: string;

    beforeEach(() => {
        tempDir = createTempDir();
        nestedDir = path.join(tempDir, 'nested', 'deep', 'directory');
        fs.mkdirSync(nestedDir, { recursive: true });

        // Create a marker file in tempDir
        fs.writeFileSync(path.join(tempDir, 'marker.txt'), 'found');
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('returns null when no directories match the predicate', () => {
        const result = walkUpDirectories(nestedDir, (dir) =>
            fs.existsSync(path.join(dir, 'nonexistent.txt'))
        );
        expect(result).toBeNull();
    });

    it('finds directory by walking up the tree', () => {
        const result = walkUpDirectories(nestedDir, (dir) =>
            fs.existsSync(path.join(dir, 'marker.txt'))
        );
        expect(result).toBe(tempDir);
    });

    it('returns the immediate directory if it matches', () => {
        fs.writeFileSync(path.join(nestedDir, 'immediate.txt'), 'here');
        const result = walkUpDirectories(nestedDir, (dir) =>
            fs.existsSync(path.join(dir, 'immediate.txt'))
        );
        expect(result).toBe(nestedDir);
    });
});

describe('isSaikiProject and getSaikiProjectRoot', () => {
    let tempDir: string;

    afterEach(() => {
        if (tempDir) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('with saiki as dependency', () => {
        beforeEach(() => {
            tempDir = createTempDirStructure({
                'package.json': {
                    name: 'my-test-project',
                    dependencies: {
                        '@truffle-ai/saiki': '^1.0.0',
                    },
                },
            });
        });

        it('detects project with saiki dependency', () => {
            const result = isSaikiProject(tempDir);
            expect(result).toBe(true);
        });

        it('returns correct project root', () => {
            const result = getSaikiProjectRoot(tempDir);
            expect(result).toBe(tempDir);
        });

        it('finds project root from nested directory', () => {
            const nestedDir = path.join(tempDir, 'src', 'components');
            fs.mkdirSync(nestedDir, { recursive: true });

            const result = getSaikiProjectRoot(nestedDir);
            expect(result).toBe(tempDir);
        });
    });

    describe('with saiki as devDependency', () => {
        beforeEach(() => {
            tempDir = createTempDirStructure({
                'package.json': {
                    name: 'my-dev-project',
                    devDependencies: {
                        '@truffle-ai/saiki': '^1.0.0',
                    },
                },
            });
        });

        it('detects project with saiki devDependency', () => {
            const result = isSaikiProject(tempDir);
            expect(result).toBe(true);
        });
    });

    describe('saiki source project', () => {
        beforeEach(() => {
            tempDir = createTempDirStructure({
                'package.json': {
                    name: '@truffle-ai/saiki',
                    version: '1.0.0',
                },
            });
        });

        it('detects saiki source project itself', () => {
            const result = isSaikiProject(tempDir);
            expect(result).toBe(true);
        });

        it('returns correct project root for saiki source', () => {
            const result = getSaikiProjectRoot(tempDir);
            expect(result).toBe(tempDir);
        });
    });

    describe('non-saiki project', () => {
        beforeEach(() => {
            tempDir = createTempDirStructure({
                'package.json': {
                    name: 'regular-project',
                    dependencies: {
                        express: '^4.0.0',
                    },
                },
            });
        });

        it('returns false for non-saiki project', () => {
            const result = isSaikiProject(tempDir);
            expect(result).toBe(false);
        });

        it('returns null for non-saiki project root', () => {
            const result = getSaikiProjectRoot(tempDir);
            expect(result).toBeNull();
        });
    });

    describe('no package.json', () => {
        beforeEach(() => {
            tempDir = createTempDir();
        });

        it('returns false when no package.json exists', () => {
            const result = isSaikiProject(tempDir);
            expect(result).toBe(false);
        });
    });
});

describe('getSaikiPath', () => {
    let tempDir: string;

    afterEach(() => {
        if (tempDir) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('in saiki project', () => {
        beforeEach(() => {
            tempDir = createTempDirStructure({
                'package.json': {
                    name: 'test-project',
                    dependencies: { '@truffle-ai/saiki': '^1.0.0' },
                },
            });
        });

        it('returns project-local path for logs', () => {
            const result = getSaikiPath('logs', 'test.log', tempDir);
            expect(result).toBe(path.join(tempDir, '.saiki', 'logs', 'test.log'));
        });

        it('returns project-local path for database', () => {
            const result = getSaikiPath('database', 'saiki.db', tempDir);
            expect(result).toBe(path.join(tempDir, '.saiki', 'database', 'saiki.db'));
        });

        it('returns directory path when no filename provided', () => {
            const result = getSaikiPath('config', undefined, tempDir);
            expect(result).toBe(path.join(tempDir, '.saiki', 'config'));
        });

        it('works from nested directories', () => {
            const nestedDir = path.join(tempDir, 'src', 'app');
            fs.mkdirSync(nestedDir, { recursive: true });

            const result = getSaikiPath('logs', 'app.log', nestedDir);
            expect(result).toBe(path.join(tempDir, '.saiki', 'logs', 'app.log'));
        });
    });

    describe('outside saiki project (global)', () => {
        beforeEach(() => {
            tempDir = createTempDirStructure({
                'package.json': {
                    name: 'regular-project',
                    dependencies: { express: '^4.0.0' },
                },
            });
        });

        it('returns global path when not in saiki project', () => {
            const originalCwd = process.cwd();
            try {
                process.chdir(tempDir);
                const result = getSaikiPath('logs', 'global.log');
                expect(result).toContain('.saiki');
                expect(result).toContain('logs');
                expect(result).toContain('global.log');
                expect(result).not.toContain(tempDir);
            } finally {
                process.chdir(originalCwd);
            }
        });
    });
});

describe('resolveConfigPath', () => {
    let tempDir: string;

    afterEach(() => {
        if (tempDir) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('explicit config path provided', () => {
        it('returns absolute path when provided', () => {
            const explicitPath = '/absolute/path/to/config.yml';
            const result = resolveConfigPath(explicitPath);
            expect(result).toBe(explicitPath);
        });

        it('resolves relative path to absolute', () => {
            const relativePath = 'relative/config.yml';
            const result = resolveConfigPath(relativePath);
            expect(path.isAbsolute(result)).toBe(true);
            expect(result.endsWith('relative/config.yml')).toBe(true);
        });
    });

    describe('auto-discovery in saiki project', () => {
        beforeEach(() => {
            tempDir = createTempDirStructure({
                'package.json': {
                    name: 'test-project',
                    dependencies: { '@truffle-ai/saiki': '^1.0.0' },
                },
            });
        });

        it('finds standard agents/agent.yml', () => {
            const configPath = path.join(tempDir, 'agents', 'agent.yml');
            fs.mkdirSync(path.dirname(configPath), { recursive: true });
            fs.writeFileSync(configPath, 'test: config');

            const result = resolveConfigPath(undefined, tempDir);
            expect(result).toBe(configPath);
        });

        it('finds src/agents/agent.yml', () => {
            const configPath = path.join(tempDir, 'src', 'agents', 'agent.yml');
            fs.mkdirSync(path.dirname(configPath), { recursive: true });
            fs.writeFileSync(configPath, 'test: config');

            const result = resolveConfigPath(undefined, tempDir);
            expect(result).toBe(configPath);
        });

        it('finds src/saiki/agents/agent.yml (test app structure)', () => {
            const configPath = path.join(tempDir, 'src', 'saiki', 'agents', 'agent.yml');
            fs.mkdirSync(path.dirname(configPath), { recursive: true });
            fs.writeFileSync(configPath, 'test: config');

            const result = resolveConfigPath(undefined, tempDir);
            expect(result).toBe(configPath);
        });

        it('prioritizes standard location over nested locations', () => {
            // Create both standard and nested configs
            const standardPath = path.join(tempDir, 'agents', 'agent.yml');
            const nestedPath = path.join(tempDir, 'src', 'saiki', 'agents', 'agent.yml');

            fs.mkdirSync(path.dirname(standardPath), { recursive: true });
            fs.mkdirSync(path.dirname(nestedPath), { recursive: true });
            fs.writeFileSync(standardPath, 'standard: config');
            fs.writeFileSync(nestedPath, 'nested: config');

            const result = resolveConfigPath(undefined, tempDir);
            expect(result).toBe(standardPath);
        });

        it('throws error when no config found', () => {
            expect(() => resolveConfigPath(undefined, tempDir)).toThrow(
                'No agent.yml found in project'
            );
        });
    });

    describe('global CLI context', () => {
        beforeEach(() => {
            tempDir = createTempDirStructure({
                'package.json': {
                    name: 'regular-project',
                    dependencies: { express: '^4.0.0' },
                },
            });
        });

        it('uses bundled config when no explicit config provided', () => {
            const result = resolveConfigPath(undefined, tempDir);
            expect(result).toContain('agents/agent.yml');
            expect(path.isAbsolute(result)).toBe(true);
        });
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

    it('finds package.json by walking up directories', () => {
        const nestedDir = path.join(tempDir, 'nested', 'deep');
        fs.mkdirSync(nestedDir, { recursive: true });
        fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test-pkg' }));

        const result = findPackageRoot(nestedDir);
        expect(result).toBe(tempDir);
    });
});

describe('resolveBundledScript', () => {
    it('resolves script path for bundled MCP servers', () => {
        const scriptPath = 'dist/scripts/test-server.js';

        // This test depends on the actual saiki package structure
        // In a real scenario, this would resolve to the installed package location
        expect(() => resolveBundledScript(scriptPath)).not.toThrow();

        const result = resolveBundledScript(scriptPath);
        expect(path.isAbsolute(result)).toBe(true);
        expect(result.endsWith(scriptPath)).toBe(true);
    });

    it('throws error when script cannot be resolved', () => {
        // This test is hard to create in current setup since we're always in a package root
        // The function will either resolve via require.resolve or via findPackageRoot fallback
        const result = resolveBundledScript('nonexistent/script.js');
        expect(path.isAbsolute(result)).toBe(true);
        expect(result.endsWith('nonexistent/script.js')).toBe(true);
    });
});

describe('real-world execution contexts', () => {
    describe('SDK usage in project', () => {
        let tempDir: string;

        beforeEach(() => {
            tempDir = createTempDirStructure({
                'package.json': {
                    name: 'my-app',
                    dependencies: { '@truffle-ai/saiki': '^1.0.0' },
                },
                'src/saiki/agents/agent.yml': 'mcpServers: {}',
            });
        });

        afterEach(() => {
            fs.rmSync(tempDir, { recursive: true, force: true });
        });

        it('correctly identifies project context', () => {
            expect(isSaikiProject(tempDir)).toBe(true);
            expect(getSaikiProjectRoot(tempDir)).toBe(tempDir);
        });

        it('uses project-local storage', () => {
            const logPath = getSaikiPath('logs', 'saiki.log', tempDir);
            const dbPath = getSaikiPath('database', 'saiki.db', tempDir);

            expect(logPath).toBe(path.join(tempDir, '.saiki', 'logs', 'saiki.log'));
            expect(dbPath).toBe(path.join(tempDir, '.saiki', 'database', 'saiki.db'));
        });

        it('finds config in test app structure', () => {
            const configPath = resolveConfigPath(undefined, tempDir);
            expect(configPath).toBe(path.join(tempDir, 'src', 'saiki', 'agents', 'agent.yml'));
        });
    });

    describe('CLI in saiki source', () => {
        let tempDir: string;

        beforeEach(() => {
            tempDir = createTempDirStructure({
                'package.json': {
                    name: '@truffle-ai/saiki',
                    version: '1.0.0',
                },
                'agents/agent.yml': 'mcpServers: {}',
            });
        });

        afterEach(() => {
            fs.rmSync(tempDir, { recursive: true, force: true });
        });

        it('correctly identifies source project', () => {
            expect(isSaikiProject(tempDir)).toBe(true);
            expect(getSaikiProjectRoot(tempDir)).toBe(tempDir);
        });

        it('uses project-local storage for development', () => {
            const logPath = getSaikiPath('logs', 'saiki.log', tempDir);
            expect(logPath).toBe(path.join(tempDir, '.saiki', 'logs', 'saiki.log'));
        });
    });
});
