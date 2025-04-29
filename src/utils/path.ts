import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

/**
 * Default config file path (relative to package root)
 */
export const DEFAULT_CONFIG_PATH = 'configuration/saiki.yml';

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
        // Resolve relative to the package root by locating package.json upwards
        const scriptPath = fileURLToPath(import.meta.url);
        let dir = path.dirname(scriptPath);
        while (true) {
            const pkgPath = path.join(dir, 'package.json');
            if (fs.existsSync(pkgPath)) {
                return path.resolve(dir, targetPath);
            }
            const parent = path.dirname(dir);
            if (parent === dir) {
                throw new Error(
                    `Cannot find package root when resolving default path: ${targetPath}`
                );
            }
            dir = parent;
        }
    }
    // User-specified relative path
    return path.resolve(process.cwd(), targetPath);
}
