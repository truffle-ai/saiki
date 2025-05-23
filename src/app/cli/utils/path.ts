import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Recursively searches up the directory tree to find the project root
 * by looking for package manager lock files
 * @param startPath The directory to start searching from
 * @returns The path to the project root directory, or null if not found
 */
export function findProjectRoot(startPath: string): string | null {
    const lockFiles = [
        'package-lock.json', // npm
        'yarn.lock', // yarn
        'pnpm-lock.yaml', // pnpm
        'bun.lock', // bun
    ];

    // Check if any lock file exists in current directory
    for (const lockFile of lockFiles) {
        if (existsSync(join(startPath, lockFile))) {
            return startPath;
        }
    }

    // Get parent directory
    const parentDir = join(startPath, '..');

    // If we've reached the root directory, return null
    if (parentDir === startPath) {
        return null;
    }

    // Recursively check parent directory
    return findProjectRoot(parentDir);
}
