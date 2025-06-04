import * as path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { promises as fsPromises } from 'fs';

/**
 * Default config file path (relative to package root)
 */
export const DEFAULT_CONFIG_PATH = 'configuration/saiki.yml';

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
export async function isDirectoryPackage(dirPath: string, packageName: string): Promise<boolean> {
    const packageJsonPath = path.join(dirPath, 'package.json');

    try {
        const packageJson = JSON.parse(await fsPromises.readFile(packageJsonPath, 'utf-8'));
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
export async function findPackageByName(
    packageName: string,
    startPath: string = process.cwd()
): Promise<string | null> {
    return walkUpDirectoriesAsync(startPath, async (dirPath) => {
        return await isDirectoryPackage(dirPath, packageName);
    });
}

/**
 * Check if current directory is the Saiki project
 * @param dirPath Directory to check (defaults to current working directory)
 * @returns True if the directory is the Saiki project root
 */
export async function isCurrentDirectorySaikiProject(
    dirPath: string = process.cwd()
): Promise<boolean> {
    return await isDirectoryPackage(dirPath, '@truffle-ai/saiki');
}

/**
 * Find the Saiki project root by walking up directories
 * @param startPath Starting directory path
 * @returns The Saiki project root directory, or null if not found
 */
export async function findSaikiProjectRoot(
    startPath: string = process.cwd()
): Promise<string | null> {
    return await findPackageByName('@truffle-ai/saiki', startPath);
}

/**
 * Detect if we're running as a global install (not in the Saiki project directory)
 * @returns True if running globally, false if in Saiki project
 */
export async function isGlobalInstall(): Promise<boolean> {
    const isInSaikiProject = await isCurrentDirectorySaikiProject();
    return !isInSaikiProject;
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
        // Resolve relative to the package root
        // Find package root starting from current working directory
        const packageRoot = findPackageRoot(process.cwd());

        if (!packageRoot) {
            throw new Error(`Cannot find package root when resolving default path: ${targetPath}`);
        }

        return path.resolve(packageRoot, targetPath);
    }
    // User-specified relative path
    return path.resolve(process.cwd(), targetPath);
}
