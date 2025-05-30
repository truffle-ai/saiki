import { promises as fs } from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { logger } from '../logger/index.js';
import { StorageContext } from './types.js';
import {
    isCurrentDirectorySaikiProject,
    findSaikiProjectRoot,
    isGlobalInstall as utilsIsGlobalInstall,
} from '../utils/path.js';

/**
 * Resolves storage paths for Saiki's local storage backends.
 * Handles the logic for determining whether to use global (~/.saiki)
 * or project-local (.saiki) storage based on context.
 */
export class StoragePathResolver {
    static readonly SAIKI_DIR = '.saiki';

    /**
     * Create storage context for local storage with automatic global detection
     */
    static async createLocalContextWithAutoDetection(
        options: {
            isDevelopment?: boolean;
            projectRoot?: string;
            customRoot?: string;
        } = {}
    ): Promise<StorageContext> {
        // Check for explicit environment variable overrides first
        const forceGlobalEnv = process.env.SAIKI_FORCE_GLOBAL_STORAGE;
        const forceLocalEnv = process.env.SAIKI_FORCE_LOCAL_STORAGE;

        let forceGlobal: boolean;

        if (forceGlobalEnv === 'true' || forceGlobalEnv === '1') {
            forceGlobal = true;
            logger.debug(
                'Using global storage due to SAIKI_FORCE_GLOBAL_STORAGE environment variable'
            );
        } else if (forceLocalEnv === 'true' || forceLocalEnv === '1') {
            forceGlobal = false;
            logger.debug(
                'Using local storage due to SAIKI_FORCE_LOCAL_STORAGE environment variable'
            );
        } else {
            // Auto-detect based on whether we're in the Saiki project
            forceGlobal = await utilsIsGlobalInstall();
            logger.debug(
                `Auto-detected ${forceGlobal ? 'global' : 'local'} storage based on current directory`
            );
        }

        return this.createLocalContext({
            ...options,
            forceGlobal,
        });
    }

    /**
     * Create storage context for local storage
     */
    static async createLocalContext(
        options: {
            isDevelopment?: boolean;
            projectRoot?: string;
            forceGlobal?: boolean;
            customRoot?: string;
        } = {}
    ): Promise<StorageContext> {
        const isDevelopment = options.isDevelopment ?? process.env.NODE_ENV !== 'production';
        let projectRoot = options.projectRoot;
        const forceGlobal = options.forceGlobal ?? false;

        // If projectRoot is explicitly provided, verify it's actually a Saiki project
        if (projectRoot && !forceGlobal) {
            const isSaikiProject = await isCurrentDirectorySaikiProject(projectRoot);
            if (!isSaikiProject) {
                logger.debug(
                    `Provided projectRoot ${projectRoot} is not a Saiki project, falling back to global storage`
                );
                projectRoot = undefined;
            }
        }

        // If no explicit projectRoot, try to detect one
        if (!projectRoot && !forceGlobal) {
            projectRoot = await findSaikiProjectRoot();
        }

        return {
            isDevelopment,
            projectRoot: projectRoot || undefined,
            forceGlobal,
            customRoot: options.customRoot,
        };
    }

    /**
     * Create storage context for remote storage
     */
    static createRemoteContext(
        connectionString: string,
        options: {
            isDevelopment?: boolean;
            projectRoot?: string;
            connectionOptions?: Record<string, any>;
        } = {}
    ): StorageContext {
        return {
            isDevelopment: options.isDevelopment ?? process.env.NODE_ENV !== 'production',
            projectRoot: options.projectRoot,
            connectionString,
            connectionOptions: options.connectionOptions,
        };
    }

    /**
     * Resolve the base storage directory based on context
     */
    static async resolveStorageRoot(context: StorageContext): Promise<string> {
        // 1. Custom root takes precedence
        if (context.customRoot) {
            await this.ensureDirectory(context.customRoot);
            logger.debug(`Using custom storage root: ${context.customRoot}`);
            return context.customRoot;
        }

        // 2. Force global if specified
        if (context.forceGlobal) {
            const globalPath = path.join(homedir(), this.SAIKI_DIR);
            await this.ensureDirectory(globalPath);
            logger.debug(`Using forced global storage: ${globalPath}`);
            return globalPath;
        }

        // 3. Try project-local storage if we have a project root
        if (context.projectRoot) {
            const projectPath = path.join(context.projectRoot, this.SAIKI_DIR);
            await this.ensureDirectory(projectPath);
            logger.debug(`Using project-local storage: ${projectPath}`);
            return projectPath;
        }

        // 4. Fall back to global storage
        const globalPath = path.join(homedir(), this.SAIKI_DIR);
        await this.ensureDirectory(globalPath);
        logger.debug(`Falling back to global storage: ${globalPath}`);
        return globalPath;
    }

    /**
     * Resolve a specific storage path within the storage root
     * This is the main method used by storage implementations
     */
    static async resolveStoragePath(
        context: StorageContext,
        namespace: string,
        filename?: string
    ): Promise<string> {
        const root = await this.resolveStorageRoot(context);
        const namespacePath = path.join(root, namespace);
        await this.ensureDirectory(namespacePath);

        if (filename) {
            return path.join(namespacePath, filename);
        }

        return namespacePath;
    }

    /**
     * Ensure a directory exists, creating it if necessary
     */
    static async ensureDirectory(dirPath: string): Promise<void> {
        try {
            await fs.access(dirPath);
        } catch {
            await fs.mkdir(dirPath, { recursive: true });
        }
    }

    // The following methods are kept for backwards compatibility and testing
    // but delegate to the consolidated path utilities

    /**
     * @deprecated Use path utilities directly from src/core/utils/path.js
     */
    static async isGlobalInstall(): Promise<boolean> {
        return utilsIsGlobalInstall();
    }

    /**
     * @deprecated Use path utilities directly from src/core/utils/path.js
     */
    static async isDirectorySaikiProject(dirPath: string): Promise<boolean> {
        return isCurrentDirectorySaikiProject(dirPath);
    }

    /**
     * @deprecated Use path utilities directly from src/core/utils/path.js
     */
    static async detectProjectRoot(startPath: string = process.cwd()): Promise<string | null> {
        return findSaikiProjectRoot(startPath);
    }

    /**
     * @deprecated Use path utilities directly from src/core/utils/path.js
     */
    static isSaikiProject(packageJson: any): boolean {
        // Check if it's the main Saiki project
        if (packageJson.name === '@truffle-ai/saiki') {
            return true;
        }

        // Check for Saiki as a dependency
        const deps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
            ...packageJson.peerDependencies,
        };

        return Object.keys(deps).some(
            (dep) => dep.includes('saiki') || dep.includes('@truffle-ai/saiki')
        );
    }
}
