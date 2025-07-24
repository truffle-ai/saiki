import * as path from 'path';
import { existsSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import { homedir } from 'os';

// Create require function for ES modules
const require = createRequire(import.meta.url);

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
 * Async version of directory walker for async predicates
 * @param startPath Starting directory path
 * @param predicate Async function that returns true when the desired condition is found
 * @returns The directory path where the condition was met, or null if not found
 */
export async function walkUpDirectoriesAsync(
    startPath: string,
    predicate: (dirPath: string) => Promise<boolean>
): Promise<string | null> {
    let currentPath = path.resolve(startPath);
    const rootPath = path.parse(currentPath).root;

    while (currentPath !== rootPath) {
        if (await predicate(currentPath)) {
            return currentPath;
        }
        currentPath = path.dirname(currentPath);
    }

    return null;
}

/**
 * Find the nearest package.json by walking up directories
 * @param startPath Starting directory path
 * @returns The directory containing package.json, or null if not found
 */
export function findPackageRoot(startPath: string = process.cwd()): string | null {
    return walkUpDirectories(startPath, (dirPath) => {
        const pkgPath = path.join(dirPath, 'package.json');
        return existsSync(pkgPath);
    });
}

/**
 * Find project root by looking for package manager lock files
 * @param startPath Starting directory path
 * @returns The project root directory, or null if not found
 */
export function findProjectRootByLockFiles(startPath: string = process.cwd()): string | null {
    const lockFiles = [
        'package-lock.json', // npm
        'yarn.lock', // yarn
        'pnpm-lock.yaml', // pnpm
        'bun.lock', // bun
    ];

    return walkUpDirectories(startPath, (dirPath) => {
        return lockFiles.some((lockFile) => existsSync(path.join(dirPath, lockFile)));
    });
}

/**
 * Check if a specific directory contains a package.json with a given name
 * @param dirPath Directory to check
 * @param packageName Expected package name
 * @returns True if the directory contains the specified package
 */
export function isDirectoryPackage(dirPath: string, packageName: string): boolean {
    const packageJsonPath = path.join(dirPath, 'package.json');

    try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        return packageJson.name === packageName;
    } catch {
        return false;
    }
}

/**
 * Find directory containing a package with a specific name
 * @param packageName Package name to search for
 * @param startPath Starting directory path
 * @returns The directory containing the specified package, or null if not found
 */
export function findPackageByName(
    packageName: string,
    startPath: string = process.cwd()
): string | null {
    return walkUpDirectories(startPath, (dirPath) => {
        return isDirectoryPackage(dirPath, packageName);
    });
}

/**
 * Check if current directory is the Dexto project
 * @param dirPath Directory to check (defaults to current working directory)
 * @returns True if the directory is the Dexto project root
 */
export function isCurrentDirectoryDextoProject(dirPath: string = process.cwd()): boolean {
    return isDirectoryPackage(dirPath, '@truffle-ai/saiki');
}

/**
 * Find the Dexto project root by walking up directories
 * @param startPath Starting directory path
 * @returns The Dexto project root directory, or null if not found
 */
export function findDextoProjectRoot(startPath: string = process.cwd()): string | null {
    return findPackageByName('@truffle-ai/saiki', startPath);
}

/**
 * Detect if we're running as a global install (not in the Dexto project directory)
 * @returns True if running globally, false if in Dexto project
 */
export function isGlobalInstall(): boolean {
    const isInDextoProject = isDextoProject();
    return !isInDextoProject;
}

/**
 * Resolve the configuration file path.
 * - If it's absolute, return as-is.
 * - If it's the default config, resolve relative to the package installation root.
 * - Otherwise resolve relative to the current working directory.
 */
export function resolvePackagePath(targetPath: string, resolveFromPackageRoot: boolean): string {
    if (path.isAbsolute(targetPath)) {
        return targetPath;
    }
    if (resolveFromPackageRoot) {
        // For default config, we need to find the actual Dexto package installation root
        try {
            // First try to find the installed package using require.resolve
            // This works for both global installs and local development
            const packageJsonPath = require.resolve('@truffle-ai/saiki/package.json');
            const packageRoot = path.dirname(packageJsonPath);
            return path.resolve(packageRoot, targetPath);
        } catch (_err) {
            // If require.resolve fails, fall back to the old method
            // This should handle edge cases or development scenarios
            const packageRoot = findPackageRoot(process.cwd());

            if (!packageRoot) {
                throw new Error(
                    `Cannot find package root when resolving default path: ${targetPath}`
                );
            }

            return path.resolve(packageRoot, targetPath);
        }
    }
    // User-specified relative path
    return path.resolve(process.cwd(), targetPath);
}

/**
 * Check if a directory contains a Dexto configuration file
 * @param dirPath Directory to check
 * @returns True if the directory contains agents/agent.yml
 */
export function hasDextoConfig(dirPath: string): boolean {
    const configPath = path.join(dirPath, DEFAULT_CONFIG_PATH);
    return existsSync(configPath);
}

/**
 * Resolve the default log file path for Dexto
 * Uses reliable synchronous detection for immediate use in logger initialization
 * @param logFileName Optional custom log file name (defaults to 'dexto.log')
 * @returns Absolute path to the log file
 */
export function resolveDextoLogPath(logFileName: string = 'dexto.log'): string {
    // Use reliable package detection - check if we're in a Dexto project
    const isInDextoProject = isDextoProject();
    const logDir = isInDextoProject
        ? path.join(process.cwd(), '.dexto', 'logs')
        : path.join(homedir(), '.dexto', 'logs');

    return path.join(logDir, logFileName);
}

/**
 * Find Dexto project root by looking for agents/agent.yml
 * @param startPath Starting directory path
 * @returns The directory containing agents/agent.yml, or null if not found
 */
export function findDextoProjectByConfig(startPath: string = process.cwd()): string | null {
    return walkUpDirectories(startPath, hasDextoConfig);
}

/**
 * Enhanced Dexto project detection that checks both package.json and config file
 * @param dirPath Directory to check (defaults to current working directory)
 * @returns True if the directory is a Dexto project (by package name OR config file)
 */
export function isDextoProject(dirPath: string = process.cwd()): boolean {
    // Check for package.json with @truffle-ai/saiki name
    const isPackage = isDirectoryPackage(dirPath, '@truffle-ai/saiki');
    if (isPackage) {
        return true;
    }

    // Check for agents/agent.yml
    return hasDextoConfig(dirPath);
}

/**
 * Enhanced Dexto project root finder that checks both package.json and config file
 * @param startPath Starting directory path
 * @returns The Dexto project root directory, or null if not found
 */
export function findDextoProjectRootEnhanced(startPath: string = process.cwd()): string | null {
    // First try finding by package.json
    const packageRoot = findPackageByName('@truffle-ai/saiki', startPath);
    if (packageRoot) {
        return packageRoot;
    }

    // Then try finding by configuration file
    return findDextoProjectByConfig(startPath);
}
