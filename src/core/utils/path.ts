import * as path from 'path';
import { existsSync, readFileSync } from 'fs';
import { promises as fs } from 'fs';
import { homedir } from 'os';
import { createRequire } from 'module';
import dotenv from 'dotenv';
import { ConfigFileNotFoundError } from '@core/error/index.js';
/**
 * Default config file path (relative to package root)
 */
export const DEFAULT_CONFIG_PATH = 'agents/agent.yml';

/**
 * Generic directory walker that searches up the directory tree
 * @param startPath Starting directory path
 * @param predicate Function that returns true when the desired condition is found
 * @returns The directory path where the condition was met, or null if not found
 */
export function walkUpDirectories(
    startPath: string,
    predicate: (dirPath: string) => boolean
): string | null {
    let currentPath = path.resolve(startPath);
    const rootPath = path.parse(currentPath).root;

    while (currentPath !== rootPath) {
        if (predicate(currentPath)) {
            return currentPath;
        }
        currentPath = path.dirname(currentPath);
    }

    return null;
}

/**
 * Check if directory has dexto as dependency (MOST RELIABLE)
 * @param dirPath Directory to check
 * @returns True if directory contains dexto as dependency
 */
function hasDextoDependency(dirPath: string): boolean {
    const packageJsonPath = path.join(dirPath, 'package.json');

    try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

        // Case 1: This IS the dexto package itself (local testing)
        if (pkg.name === 'dexto') {
            return true;
        }

        // Case 2: Project using dexto as dependency (SDK/CLI in project)
        const allDeps = {
            ...pkg.dependencies,
            ...pkg.devDependencies,
            ...pkg.peerDependencies,
        };

        return 'dexto' in allDeps;
    } catch {
        return false;
    }
}

/**
 * Check if we're currently in a dexto project
 * @param startPath Starting directory path
 * @returns True if in a dexto project
 */
export function isDextoProject(startPath: string = process.cwd()): boolean {
    return getDextoProjectRoot(startPath) !== null;
}

/**
 * Get dexto project root (or null if not in project)
 * @param startPath Starting directory path
 * @returns Project root directory or null
 */
export function getDextoProjectRoot(startPath: string = process.cwd()): string | null {
    return walkUpDirectories(startPath, hasDextoDependency);
}

/**
 * Standard path resolver for logs/db/config/anything in dexto projects
 * @param type Path type (logs, database, config, etc.)
 * @param filename Optional filename to append
 * @param startPath Starting directory for project detection
 * @returns Absolute path to the requested location
 */
export function getDextoPath(type: string, filename?: string, startPath?: string): string {
    const projectRoot = getDextoProjectRoot(startPath);

    let basePath: string;

    if (projectRoot) {
        // In dexto project: /project/.dexto/logs/
        basePath = path.join(projectRoot, '.dexto', type);
    } else {
        // Global: ~/.dexto/logs/
        basePath = path.join(homedir(), '.dexto', type);
    }

    return filename ? path.join(basePath, filename) : basePath;
}

/**
 * Resolve config path with context awareness
 * @param configPath Optional explicit config path
 * @param startPath Starting directory for project detection
 * @returns Absolute path to config file
 */
export function resolveConfigPath(configPath?: string, startPath?: string): string {
    if (configPath) {
        // Explicit path provided
        return path.resolve(configPath);
    }

    const projectRoot = getDextoProjectRoot(startPath);

    if (projectRoot) {
        // In dexto project: Look for config in project (multiple possible locations)
        const configPaths = [
            path.join(projectRoot, 'agents', 'agent.yml'), // Standard
            path.join(projectRoot, 'src', 'agents', 'agent.yml'), // Common
            path.join(projectRoot, 'src', 'dexto', 'agents', 'agent.yml'), // Test app structure
            path.join(projectRoot, '.dexto', 'agent.yml'), // Hidden
            path.join(projectRoot, 'agent.yml'), // Root
        ];

        for (const configPath of configPaths) {
            if (existsSync(configPath)) {
                return configPath;
            }
        }

        throw new ConfigFileNotFoundError(
            `No agent.yml found in project. Searched: ${configPaths.join(', ')}`
        );
    } else {
        // Global CLI: Use bundled default config
        try {
            const bundledConfigPath = resolveBundledScript('agents/agent.yml');
            if (existsSync(bundledConfigPath)) {
                return bundledConfigPath;
            }
        } catch {
            // Fallback if bundled script resolution fails
        }

        throw new ConfigFileNotFoundError(
            'Global CLI: No bundled config found and no explicit config provided'
        );
    }
}

/**
 * Find package root (for other utilities)
 * @param startPath Starting directory path
 * @returns Directory containing package.json or null
 */
export function findPackageRoot(startPath: string = process.cwd()): string | null {
    return walkUpDirectories(startPath, (dirPath) => {
        const pkgPath = path.join(dirPath, 'package.json');
        return existsSync(pkgPath);
    });
}

/**
 * Resolve bundled script paths for MCP servers
 * @param scriptPath Relative script path
 * @returns Absolute path to bundled script
 */
export function resolveBundledScript(scriptPath: string): string {
    try {
        // Try to resolve from the installed package
        const require = createRequire(import.meta.url);
        const packageJsonPath = require.resolve('dexto/package.json');
        const packageRoot = path.dirname(packageJsonPath);
        return path.resolve(packageRoot, scriptPath);
    } catch {
        // Fallback for development
        const packageRoot = findPackageRoot();
        if (!packageRoot) {
            throw new Error(`Cannot resolve bundled script: ${scriptPath}`);
        }
        return path.resolve(packageRoot, scriptPath);
    }
}

/**
 * Ensure ~/.dexto directory exists for global storage
 */
async function ensureDextoGlobalDirectory(): Promise<void> {
    const dextoDir = path.join(homedir(), '.dexto');
    try {
        await fs.mkdir(dextoDir, { recursive: true });
    } catch (error) {
        // Directory might already exist, ignore EEXIST errors
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
            throw error;
        }
    }
}

/**
 * Multi-layer environment variable loading with context awareness.
 * Loads environment variables in priority order:
 * 1. Shell environment (highest priority)
 * 2. Project .env (if in dexto project)
 * 3. Global ~/.dexto/.env (fallback)
 *
 * @param startPath Starting directory for project detection
 * @returns Combined environment variables object
 */
export async function loadEnvironmentVariables(
    startPath: string = process.cwd()
): Promise<Record<string, string>> {
    const projectRoot = getDextoProjectRoot(startPath);
    const env: Record<string, string> = {};

    // Layer 3: Global ~/.dexto/.env (lowest priority)
    const globalEnvPath = path.join(homedir(), '.dexto', '.env');
    try {
        const globalResult = dotenv.config({ path: globalEnvPath });
        if (globalResult.parsed) {
            Object.assign(env, globalResult.parsed);
        }
    } catch {
        // Global .env is optional, ignore errors
    }

    // Layer 2: Project .env (medium priority)
    if (projectRoot) {
        const projectEnvPath = path.join(projectRoot, '.env');
        try {
            const projectResult = dotenv.config({ path: projectEnvPath });
            if (projectResult.parsed) {
                Object.assign(env, projectResult.parsed);
            }
        } catch {
            // Project .env is optional, ignore errors
        }
    }

    // Layer 1: Shell environment (highest priority)
    // Filter to only include defined values (not undefined)
    for (const [key, value] of Object.entries(process.env)) {
        if (value !== undefined) {
            env[key] = value;
        }
    }

    return env;
}

/**
 * Get the appropriate .env file path for saving API keys.
 * Returns project .env if in dexto project, otherwise global ~/.dexto/.env
 *
 * @param startPath Starting directory for project detection
 * @returns Absolute path to .env file for saving
 */
export function getEnvFilePath(startPath: string = process.cwd()): string {
    const projectRoot = getDextoProjectRoot(startPath);

    if (projectRoot) {
        // In dexto project: save to project .env
        return path.join(projectRoot, '.env');
    } else {
        // Global usage: save to ~/.dexto/.env
        return path.join(homedir(), '.dexto', '.env');
    }
}

/**
 * Apply layered environment loading to process.env.
 * This replaces the simple dotenv.config() with multi-layer loading.
 * Should be called at CLI startup before any schema validation.
 *
 * @param startPath Starting directory for project detection
 */
export async function applyLayeredEnvironmentLoading(
    startPath: string = process.cwd()
): Promise<void> {
    // Ensure global directory exists for saving later
    await ensureDextoGlobalDirectory();

    // Load layered environment and apply to process.env
    const layeredEnv = await loadEnvironmentVariables(startPath);
    Object.assign(process.env, layeredEnv);
}
