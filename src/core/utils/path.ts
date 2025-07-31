import * as path from 'path';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { createRequire } from 'module';
import { logger } from '../logger/index.js';
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
 * Check if directory has saiki as dependency (MOST RELIABLE)
 * @param dirPath Directory to check
 * @returns True if directory contains saiki as dependency
 */
function hasSaikiDependency(dirPath: string): boolean {
    const packageJsonPath = path.join(dirPath, 'package.json');

    try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

        // Case 1: This IS the saiki package itself (local testing)
        if (pkg.name === '@truffle-ai/saiki') {
            return true;
        }

        // Case 2: Project using saiki as dependency (SDK/CLI in project)
        const allDeps = {
            ...pkg.dependencies,
            ...pkg.devDependencies,
            ...pkg.peerDependencies,
        };

        return '@truffle-ai/saiki' in allDeps;
    } catch {
        return false;
    }
}

/**
 * Check if we're currently in a saiki project
 * @param startPath Starting directory path
 * @returns True if in a saiki project
 */
export function isSaikiProject(startPath: string = process.cwd()): boolean {
    return getSaikiProjectRoot(startPath) !== null;
}

/**
 * Get saiki project root (or null if not in project)
 * @param startPath Starting directory path
 * @returns Project root directory or null
 */
export function getSaikiProjectRoot(startPath: string = process.cwd()): string | null {
    return walkUpDirectories(startPath, hasSaikiDependency);
}

/**
 * Standard path resolver for logs/db/config/anything in saiki projects
 * @param type Path type (logs, database, config, etc.)
 * @param filename Optional filename to append
 * @param startPath Starting directory for project detection
 * @returns Absolute path to the requested location
 */
export function getSaikiPath(type: string, filename?: string, startPath?: string): string {
    const projectRoot = getSaikiProjectRoot(startPath);

    let basePath: string;

    if (projectRoot) {
        // In saiki project: /project/.saiki/logs/
        basePath = path.join(projectRoot, '.saiki', type);
    } else {
        // Global: ~/.saiki/logs/
        basePath = path.join(homedir(), '.saiki', type);
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

    const projectRoot = getSaikiProjectRoot(startPath);

    if (projectRoot) {
        // In saiki project: Look for config in project (multiple possible locations)
        const configPaths = [
            path.join(projectRoot, 'agents', 'agent.yml'), // Standard
            path.join(projectRoot, 'src', 'agents', 'agent.yml'), // Common
            path.join(projectRoot, 'src', 'saiki', 'agents', 'agent.yml'), // Test app structure
            path.join(projectRoot, '.saiki', 'agent.yml'), // Hidden
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
        const packageJsonPath = require.resolve('@truffle-ai/saiki/package.json');
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
