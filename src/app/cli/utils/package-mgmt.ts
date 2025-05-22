import { findProjectRoot } from './path.js';
import fsExtra from 'fs-extra';
import path from 'path';
import { PackageJson } from 'type-fest';

/**
 * Returns the install command for the given package manager
 * @param pm - The package manager to use
 * @returns The install command for the given package manager
 */
export function getPackageManagerInstallCommand(pm: string): string {
    switch (pm) {
        case 'npm':
            return 'install';
        case 'yarn':
            return 'add';
        case 'pnpm':
            return 'add';
        case 'bun':
            return 'add';
        default:
            return 'install';
    }
}

/**
 * Returns the package manager for the given project
 * @returns The package manager for the given project
 */
export function getPackageManager(): string {
    const lockFile = findProjectRoot(process.cwd());
    switch (lockFile) {
        case 'pnpm-lock.yaml':
            return 'pnpm';
        case 'package-lock.json':
            return 'npm';
        case 'yarn.lock':
            return 'yarn';
        case 'bun.lock':
            return 'bun';
        default:
            return 'npm';
    }
}

/**
 * Goes all the way up to the root of the project and checks package.json to find the version of a project
 * @returns The version of the given project
 */
export async function getPackageVersion(): Promise<string> {
    const projectRoot = findProjectRoot(process.cwd());
    if (!projectRoot) {
        throw new Error('Could not find project root');
    }
    const pkgJsonPath = path.join(projectRoot, 'package.json');
    const content = (await fsExtra.readJSON(pkgJsonPath)) as PackageJson;
    return content.version;
}

/**
 * Adds scripts to the package.json file
 * @param scripts - The scripts to add to the package.json file
 */
export async function addScriptsToPackageJson(scripts: Record<string, string>) {
    const projectRoot = findProjectRoot(process.cwd());
    if (!projectRoot) {
        throw new Error('Could not find project root');
    }

    const packageJsonPath = path.join(projectRoot, 'package.json');
    const packageJson = await fsExtra.readJSON(packageJsonPath);

    packageJson.scripts = {
        ...packageJson.scripts,
        ...scripts,
    };

    await fsExtra.writeJSON(packageJsonPath, packageJson, { spaces: 2 });
}
