import * as fs from 'fs';
import * as path from 'path';
import { tmpdir, homedir } from 'os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadEnvironmentVariables, applyLayeredEnvironmentLoading, updateEnvFile } from './env.js';

// Mock homedir to control global .dexto location
vi.mock('os', async () => {
    const actual = await vi.importActual('os');
    return {
        ...actual,
        homedir: vi.fn(),
    };
});

function createTempDir() {
    return fs.mkdtempSync(path.join(tmpdir(), 'dexto-env-test-'));
}

function createTempDirStructure(structure: Record<string, any>, baseDir?: string): string {
    const tempDir = baseDir || createTempDir();

    for (const [filePath, content] of Object.entries(structure)) {
        const fullPath = path.join(tempDir, filePath);
        const dirPath = path.dirname(fullPath);

        // Create directory if it doesn't exist
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        if (typeof content === 'string') {
            fs.writeFileSync(fullPath, content);
        } else if (content === null) {
            // Create empty file
            fs.writeFileSync(fullPath, '');
        }
    }

    return tempDir;
}

function cleanupTempDir(dir: string) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

describe('Core Environment Loading', () => {
    let tempDir: string;
    let mockHomeDir: string;
    let originalEnv: Record<string, string | undefined>;

    beforeEach(() => {
        // Save original environment
        originalEnv = { ...process.env };

        // Create temp directories
        tempDir = createTempDir();
        mockHomeDir = createTempDir();

        // Mock homedir
        vi.mocked(homedir).mockReturnValue(mockHomeDir);

        // Clean up environment variables that might interfere
        delete process.env.OPENAI_API_KEY;
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        delete process.env.GROQ_API_KEY;
        delete process.env.DEXTO_LOG_LEVEL;
    });

    afterEach(() => {
        // Restore original environment
        process.env = originalEnv;

        // Cleanup temp directories
        cleanupTempDir(tempDir);
        cleanupTempDir(mockHomeDir);

        vi.clearAllMocks();
    });

    describe('loadEnvironmentVariables', () => {
        it('loads from global ~/.dexto/.env when no project', async () => {
            // Setup: Global .env only
            createTempDirStructure(
                {
                    '.dexto/.env': 'OPENAI_API_KEY=global-key\nDEXTO_LOG_LEVEL=debug',
                },
                mockHomeDir
            );

            const env = await loadEnvironmentVariables(tempDir);

            expect(env.OPENAI_API_KEY).toBe('global-key');
            expect(env.DEXTO_LOG_LEVEL).toBe('debug');
        });

        it('loads from project .env when in dexto project', async () => {
            // Setup: Dexto project with .env
            createTempDirStructure(
                {
                    'package.json': JSON.stringify({ dependencies: { dexto: '1.0.0' } }),
                    '.env': 'OPENAI_API_KEY=project-key\nDEXTO_LOG_LEVEL=info',
                },
                tempDir
            );

            const env = await loadEnvironmentVariables(tempDir);

            expect(env.OPENAI_API_KEY).toBe('project-key');
            expect(env.DEXTO_LOG_LEVEL).toBe('info');
        });

        describe('Priority Order: Shell > Project > Global', () => {
            it('shell environment beats both project and global', async () => {
                // Setup: All three layers have OPENAI_API_KEY, shell should win
                createTempDirStructure(
                    {
                        '.dexto/.env':
                            'OPENAI_API_KEY=global-key\nANTHROPIC_API_KEY=global-anthropic\nGROQ_API_KEY=skip',
                    },
                    mockHomeDir
                );

                createTempDirStructure(
                    {
                        'package.json': JSON.stringify({ dependencies: { dexto: '1.0.0' } }),
                        '.env': 'OPENAI_API_KEY=project-key\nGROQ_API_KEY=project-groq',
                    },
                    tempDir
                );

                // Shell environment (highest priority)
                process.env.OPENAI_API_KEY = 'shell-key';
                process.env.DEXTO_LOG_LEVEL = 'error';

                const env = await loadEnvironmentVariables(tempDir);

                // Shell should win over both project and global
                expect(env.OPENAI_API_KEY).toBe('shell-key');
                expect(env.DEXTO_LOG_LEVEL).toBe('error');

                // Project should win over global
                expect(env.GROQ_API_KEY).toBe('project-groq');

                // Global should be used when no project/shell override
                expect(env.ANTHROPIC_API_KEY).toBe('global-anthropic');
            });

            it('project environment beats global (without shell interference)', async () => {
                // Setup: Project overrides global, shell is clean
                createTempDirStructure(
                    {
                        '.dexto/.env':
                            'OPENAI_API_KEY=global-key\nANTHROPIC_API_KEY=global-anthropic\nGROQ_API_KEY=global-groq',
                    },
                    mockHomeDir
                );

                createTempDirStructure(
                    {
                        'package.json': JSON.stringify({ dependencies: { dexto: '1.0.0' } }),
                        '.env': 'OPENAI_API_KEY=project-key\nANTHROPIC_API_KEY=project-anthropic',
                    },
                    tempDir
                );

                const env = await loadEnvironmentVariables(tempDir);

                // Project should override global
                expect(env.OPENAI_API_KEY).toBe('project-key');
                expect(env.ANTHROPIC_API_KEY).toBe('project-anthropic');

                // Global should be used for keys not in project
                expect(env.GROQ_API_KEY).toBe('global-groq');
            });

            it('handles comprehensive multi-layer priority with same keys', async () => {
                // Setup: Same keys across all layers to test complete priority system
                createTempDirStructure(
                    {
                        '.dexto/.env':
                            'OPENAI_API_KEY=global\nANTHROPIC_API_KEY=global\nGROQ_API_KEY=global\nDEXTO_LOG_LEVEL=global',
                    },
                    mockHomeDir
                );

                createTempDirStructure(
                    {
                        'package.json': JSON.stringify({ dependencies: { dexto: '1.0.0' } }),
                        '.env': 'OPENAI_API_KEY=project\nANTHROPIC_API_KEY=project\nDEXTO_LOG_LEVEL=project',
                    },
                    tempDir
                );

                // Shell only sets some keys
                process.env.OPENAI_API_KEY = 'shell';
                process.env.GROQ_API_KEY = 'shell';

                const env = await loadEnvironmentVariables(tempDir);

                // Shell wins where present
                expect(env.OPENAI_API_KEY).toBe('shell');
                expect(env.GROQ_API_KEY).toBe('shell');

                // Project wins over global where shell not present
                expect(env.ANTHROPIC_API_KEY).toBe('project');
                expect(env.DEXTO_LOG_LEVEL).toBe('project');
            });

            it('preserves global-only variables through all merging layers', async () => {
                // Setup: Global has unique keys not touched by project/shell
                createTempDirStructure(
                    {
                        '.dexto/.env':
                            'GLOBAL_UNIQUE_KEY=preserved\nSHARED_KEY=global-value\nGOOGLE_GENERATIVE_AI_API_KEY=global-google',
                    },
                    mockHomeDir
                );

                createTempDirStructure(
                    {
                        'package.json': JSON.stringify({ dependencies: { dexto: '1.0.0' } }),
                        '.env': 'SHARED_KEY=project-value\nPROJECT_UNIQUE_KEY=project-only',
                    },
                    tempDir
                );

                process.env.SHARED_KEY = 'shell-value';
                process.env.SHELL_UNIQUE_KEY = 'shell-only';

                const env = await loadEnvironmentVariables(tempDir);

                // Global unique keys should survive
                expect(env.GLOBAL_UNIQUE_KEY).toBe('preserved');
                expect(env.GOOGLE_GENERATIVE_AI_API_KEY).toBe('global-google');

                // Project unique keys should survive
                expect(env.PROJECT_UNIQUE_KEY).toBe('project-only');

                // Shell unique keys should be present
                expect(env.SHELL_UNIQUE_KEY).toBe('shell-only');

                // Shared key should follow priority
                expect(env.SHARED_KEY).toBe('shell-value');
            });

            it('handles empty project env while preserving global values', async () => {
                // Setup: Global has values, project .env exists but empty
                createTempDirStructure(
                    {
                        '.dexto/.env':
                            'OPENAI_API_KEY=global-key\nANTHROPIC_API_KEY=global-anthropic',
                    },
                    mockHomeDir
                );

                createTempDirStructure(
                    {
                        'package.json': JSON.stringify({ dependencies: { dexto: '1.0.0' } }),
                        '.env': '', // Empty project .env
                    },
                    tempDir
                );

                const env = await loadEnvironmentVariables(tempDir);

                // Global values should be preserved despite empty project .env
                expect(env.OPENAI_API_KEY).toBe('global-key');
                expect(env.ANTHROPIC_API_KEY).toBe('global-anthropic');
            });

            it('handles empty global env while preserving project values', async () => {
                // Setup: Project has values, global .env exists but empty
                createTempDirStructure(
                    {
                        '.dexto/.env': '', // Empty global .env
                    },
                    mockHomeDir
                );

                createTempDirStructure(
                    {
                        'package.json': JSON.stringify({ dependencies: { dexto: '1.0.0' } }),
                        '.env': 'OPENAI_API_KEY=project-key\nANTHROPIC_API_KEY=project-anthropic',
                    },
                    tempDir
                );

                const env = await loadEnvironmentVariables(tempDir);

                // Project values should be present despite empty global .env
                expect(env.OPENAI_API_KEY).toBe('project-key');
                expect(env.ANTHROPIC_API_KEY).toBe('project-anthropic');
            });

            it('preserves shell environment priority in applyLayeredEnvironmentLoading', async () => {
                // Setup: Shell env + global .env, test actual process.env modification
                process.env.EXISTING_VAR = 'existing-value';
                process.env.OPENAI_API_KEY = 'shell-key';

                createTempDirStructure(
                    {
                        '.dexto/.env': 'OPENAI_API_KEY=global-key\nNEW_VAR=new-value',
                    },
                    mockHomeDir
                );

                await applyLayeredEnvironmentLoading(tempDir);

                // Shell should win and be preserved in process.env
                expect(process.env.OPENAI_API_KEY).toBe('shell-key');
                // Existing shell vars should be preserved
                expect(process.env.EXISTING_VAR).toBe('existing-value');
                // New vars from files should be added
                expect(process.env.NEW_VAR).toBe('new-value');
            });
        });

        it('handles missing global .dexto directory gracefully', async () => {
            // Setup: Project only, no global directory
            createTempDirStructure(
                {
                    'package.json': JSON.stringify({ dependencies: { dexto: '1.0.0' } }),
                    '.env': 'OPENAI_API_KEY=project-key',
                },
                tempDir
            );

            const env = await loadEnvironmentVariables(tempDir);

            expect(env.OPENAI_API_KEY).toBe('project-key');
        });

        it('handles missing project .env file gracefully', async () => {
            // Setup: Global only, project has no .env
            createTempDirStructure(
                {
                    '.dexto/.env': 'OPENAI_API_KEY=global-key',
                },
                mockHomeDir
            );

            createTempDirStructure(
                {
                    'package.json': JSON.stringify({ dependencies: { dexto: '1.0.0' } }),
                    // No .env file
                },
                tempDir
            );

            const env = await loadEnvironmentVariables(tempDir);

            expect(env.OPENAI_API_KEY).toBe('global-key');
        });

        it('handles malformed .env files gracefully', async () => {
            // Setup: Malformed global .env
            createTempDirStructure(
                {
                    '.dexto/.env': 'INVALID_LINE_WITHOUT_EQUALS\nOPENAI_API_KEY=valid-key',
                },
                mockHomeDir
            );

            const env = await loadEnvironmentVariables(tempDir);

            // Should still load valid entries
            expect(env.OPENAI_API_KEY).toBe('valid-key');
        });

        it('handles empty .env files', async () => {
            // Setup: Empty files
            createTempDirStructure(
                {
                    '.dexto/.env': '',
                },
                mockHomeDir
            );

            createTempDirStructure(
                {
                    'package.json': JSON.stringify({ dependencies: { dexto: '1.0.0' } }),
                    '.env': '',
                },
                tempDir
            );

            // Shell environment should still work
            process.env.OPENAI_API_KEY = 'shell-key';

            const env = await loadEnvironmentVariables(tempDir);

            expect(env.OPENAI_API_KEY).toBe('shell-key');
        });

        it('filters out undefined environment variables', async () => {
            process.env.DEFINED_VAR = 'value';
            process.env.UNDEFINED_VAR = undefined;

            const env = await loadEnvironmentVariables(tempDir);

            expect(env.DEFINED_VAR).toBe('value');
            expect('UNDEFINED_VAR' in env).toBe(false);
        });
    });

    describe('applyLayeredEnvironmentLoading', () => {
        it('applies loaded environment to process.env', async () => {
            // Setup: Global .env with API key
            createTempDirStructure(
                {
                    '.dexto/.env': 'OPENAI_API_KEY=global-key\nDEXTO_LOG_LEVEL=debug',
                },
                mockHomeDir
            );

            // Ensure these are not set initially
            delete process.env.OPENAI_API_KEY;
            delete process.env.DEXTO_LOG_LEVEL;

            await applyLayeredEnvironmentLoading(tempDir);

            expect(process.env.OPENAI_API_KEY).toBe('global-key');
            expect(process.env.DEXTO_LOG_LEVEL).toBe('debug');
        });

        it('creates global .dexto directory if it does not exist', async () => {
            const dextoDir = path.join(mockHomeDir, '.dexto');
            expect(fs.existsSync(dextoDir)).toBe(false);

            await applyLayeredEnvironmentLoading(tempDir);

            expect(fs.existsSync(dextoDir)).toBe(true);
        });
    });

    describe('updateEnvFile', () => {
        it('creates new .env file with Dexto section', async () => {
            const envFilePath = path.join(tempDir, '.env');

            await updateEnvFile(envFilePath, {
                OPENAI_API_KEY: 'test-key',
                DEXTO_LOG_LEVEL: 'info',
            });

            const content = fs.readFileSync(envFilePath, 'utf8');
            expect(content).toContain('## Dexto env variables');
            expect(content).toContain('OPENAI_API_KEY=test-key');
            expect(content).toContain('DEXTO_LOG_LEVEL=info');
        });

        it('updates existing .env file preserving other content', async () => {
            const envFilePath = path.join(tempDir, '.env');

            // Create existing .env with other content
            fs.writeFileSync(envFilePath, 'OTHER_VAR=other-value\nANOTHER_VAR=another-value\n');

            await updateEnvFile(envFilePath, {
                OPENAI_API_KEY: 'test-key',
            });

            const content = fs.readFileSync(envFilePath, 'utf8');
            expect(content).toContain('OTHER_VAR=other-value');
            expect(content).toContain('ANOTHER_VAR=another-value');
            expect(content).toContain('## Dexto env variables');
            expect(content).toContain('OPENAI_API_KEY=test-key');
        });

        it('replaces existing Dexto section', async () => {
            const envFilePath = path.join(tempDir, '.env');

            // Create existing .env with old Dexto section
            const oldContent = [
                'OTHER_VAR=other-value',
                '',
                '## Dexto env variables',
                'OPENAI_API_KEY=old-key',
                'ANTHROPIC_API_KEY=old-anthropic',
                '',
                'FINAL_VAR=final-value',
            ].join('\n');

            fs.writeFileSync(envFilePath, oldContent);

            await updateEnvFile(envFilePath, {
                OPENAI_API_KEY: 'new-key',
                GROQ_API_KEY: 'new-groq',
            });

            const content = fs.readFileSync(envFilePath, 'utf8');
            expect(content).toContain('OTHER_VAR=other-value');
            expect(content).toContain('FINAL_VAR=final-value');
            expect(content).toContain('OPENAI_API_KEY=new-key');
            expect(content).toContain('GROQ_API_KEY=new-groq');
            expect(content).not.toContain('old-key');
            // ANTHROPIC_API_KEY should be preserved since we didn't update it
            expect(content).toContain('ANTHROPIC_API_KEY=old-anthropic');
        });

        it('handles empty updates gracefully', async () => {
            const envFilePath = path.join(tempDir, '.env');

            await updateEnvFile(envFilePath, {});

            const content = fs.readFileSync(envFilePath, 'utf8');
            expect(content).toContain('## Dexto env variables');
            // Should still create the section structure
        });

        it('creates directory structure if it does not exist', async () => {
            const deepPath = path.join(tempDir, 'nested', 'deep', '.env');

            await updateEnvFile(deepPath, {
                OPENAI_API_KEY: 'test-key',
            });

            expect(fs.existsSync(deepPath)).toBe(true);
            const content = fs.readFileSync(deepPath, 'utf8');
            expect(content).toContain('OPENAI_API_KEY=test-key');
        });
    });
});
