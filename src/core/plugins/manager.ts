/**
 * Plugin manager for loading, managing, and executing plugins
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { pathToFileURL } from 'url';
import { resolve, extname, basename } from 'path';
import { logger } from '../logger/index.js';
import { HookExecutor } from './base.js';
import type {
    IPlugin,
    PluginConfig,
    PluginLoadResult,
    PluginRegistryEntry,
    PluginContext,
    PluginExecutionResult,
    PluginHooks,
} from './types.js';
import { PluginState } from './types.js';

/**
 * Plugin manager handles loading, initialization, and execution of plugins
 */
export class PluginManager {
    private plugins: Map<string, PluginRegistryEntry> = new Map();
    private hookExecutor: HookExecutor;
    private baseContext: Omit<PluginContext, 'sessionId' | 'sessionEventBus'>;
    private configBasePath: string;

    constructor(
        baseContext: Omit<PluginContext, 'sessionId' | 'sessionEventBus'>,
        configBasePath: string = process.cwd()
    ) {
        this.baseContext = baseContext;
        this.configBasePath = configBasePath;
        this.hookExecutor = new HookExecutor();

        logger.info('PluginManager initialized');
    }

    /**
     * Load plugins from configuration
     */
    public async loadPlugins(pluginConfigs: PluginConfig[]): Promise<void> {
        logger.info(`Loading ${pluginConfigs.length} plugins`);

        // Sort plugins by priority (lower numbers first)
        const sortedConfigs = [...pluginConfigs].sort(
            (a, b) => (a.priority || 50) - (b.priority || 50)
        );

        for (const config of sortedConfigs) {
            if (!config.enabled) {
                logger.debug(`Skipping disabled plugin: ${config.name}`);
                continue;
            }

            try {
                await this.loadPlugin(config);
            } catch (error) {
                logger.error(
                    `Failed to load plugin '${config.name}': ${error instanceof Error ? error.message : String(error)}`
                );
                // Continue loading other plugins even if one fails
            }
        }

        logger.info(`Loaded ${this.getActivePluginCount()} active plugins`);
    }

    /**
     * Load a single plugin
     */
    public async loadPlugin(config: PluginConfig): Promise<PluginLoadResult> {
        const startTime = Date.now();
        logger.debug(`Loading plugin: ${config.name} from ${config.path}`);

        // Check if plugin is already loaded
        if (this.plugins.has(config.name)) {
            const existing = this.plugins.get(config.name)!;
            if (existing.state !== PluginState.ERROR) {
                logger.warn(`Plugin '${config.name}' is already loaded`);
                return {
                    success: false,
                    error: 'Plugin already loaded',
                };
            }
            // If it's in error state, we can try to reload it
            await this.unloadPlugin(config.name);
        }

        // Create registry entry
        const entry: PluginRegistryEntry = {
            config,
            state: PluginState.LOADING,
            loadedAt: new Date(),
        };
        this.plugins.set(config.name, entry);

        try {
            // Resolve plugin path relative to config base path
            const pluginPath = resolve(this.configBasePath, config.path);

            // Validate plugin file exists
            try {
                await readFile(pluginPath);
            } catch (_error) {
                throw new Error(`Plugin file not found: ${pluginPath}`);
            }

            // Handle TypeScript files by compiling them first
            const finalPluginPath = await this.preparePluginFile(pluginPath);

            // Load plugin module
            const pluginUrl = pathToFileURL(finalPluginPath).href;
            const pluginModule = await import(pluginUrl);

            // Extract plugin class or factory
            let PluginClass: new () => IPlugin;
            if (pluginModule.default) {
                PluginClass = pluginModule.default;
            } else if (pluginModule.Plugin) {
                PluginClass = pluginModule.Plugin;
            } else {
                throw new Error('Plugin must export a default class or named Plugin class');
            }

            // Instantiate plugin
            const plugin = new PluginClass();

            // Validate plugin interface
            this.validatePlugin(plugin);

            // Verify plugin name matches config
            if (plugin.name !== config.name) {
                throw new Error(
                    `Plugin name mismatch: expected '${config.name}', got '${plugin.name}'`
                );
            }

            // Update registry entry
            entry.plugin = plugin;
            entry.state = PluginState.LOADED;
            entry.loadResult = {
                success: true,
                plugin,
            };

            // Register with hook executor
            this.hookExecutor.registerPlugin(plugin, config.priority || 50);

            const duration = Date.now() - startTime;
            logger.info(`Plugin '${config.name}' loaded successfully in ${duration}ms`);

            return {
                success: true,
                plugin,
            };
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            entry.state = PluginState.ERROR;
            entry.lastError = err.message;
            entry.loadResult = {
                success: false,
                error: err.message,
            };

            logger.error(`Failed to load plugin '${config.name}': ${err.message}`);

            // Remove failed plugin from registry
            this.plugins.delete(config.name);

            return {
                success: false,
                error: err.message,
            };
        }
    }

    /**
     * Initialize all loaded plugins
     */
    public async initializePlugins(): Promise<void> {
        logger.info('Initializing loaded plugins');

        for (const [name, entry] of this.plugins) {
            if (entry.state === PluginState.LOADED && entry.plugin) {
                try {
                    await this.initializePlugin(name);
                } catch (error) {
                    logger.error(
                        `Failed to initialize plugin '${name}': ${error instanceof Error ? error.message : String(error)}`
                    );
                }
            }
        }

        logger.info(`Initialized ${this.getActivePluginCount()} plugins`);
    }

    /**
     * Initialize a single plugin
     */
    public async initializePlugin(name: string): Promise<void> {
        const entry = this.plugins.get(name);
        if (!entry) {
            throw new Error(`Plugin '${name}' not found`);
        }

        if (entry.state !== PluginState.LOADED || !entry.plugin) {
            throw new Error(`Plugin '${name}' is not loaded`);
        }

        logger.debug(`Initializing plugin: ${name}`);

        try {
            // Create plugin context (without session-specific data)
            const context: PluginContext = {
                ...this.baseContext,
                sessionId: '', // Will be set when executing hooks
                sessionEventBus: null as any, // Will be set when executing hooks
            };

            // Initialize plugin
            await entry.plugin.initialize(context, entry.config.config);
            entry.state = PluginState.ACTIVE;

            logger.info(`Plugin '${name}' initialized successfully`);
        } catch (error) {
            entry.state = PluginState.ERROR;
            entry.lastError = error instanceof Error ? error.message : String(error);
            throw error;
        }
    }

    /**
     * Unload a plugin
     */
    public async unloadPlugin(name: string): Promise<void> {
        const entry = this.plugins.get(name);
        if (!entry) {
            logger.warn(`Plugin '${name}' not found for unloading`);
            return;
        }

        logger.debug(`Unloading plugin: ${name}`);

        try {
            // Cleanup plugin if it's active
            if (entry.plugin && entry.state === PluginState.ACTIVE) {
                await entry.plugin.cleanup();
            }

            // Unregister from hook executor
            this.hookExecutor.unregisterPlugin(name);

            // Remove from registry
            this.plugins.delete(name);

            logger.info(`Plugin '${name}' unloaded successfully`);
        } catch (error) {
            logger.error(
                `Error unloading plugin '${name}': ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    }

    /**
     * Execute a hook across all active plugins
     */
    public async executeHook<T extends keyof PluginHooks>(
        hookName: T,
        sessionId: string,
        sessionEventBus: any,
        context: Parameters<NonNullable<PluginHooks[T]>>[0],
        initialData?: any
    ): Promise<PluginExecutionResult> {
        // Update context with session-specific data
        const fullContext = {
            ...context,
            sessionId,
            sessionEventBus,
        };

        return this.hookExecutor.executeHook(hookName, fullContext, initialData);
    }

    /**
     * Execute a lifecycle hook
     */
    public async executeLifecycleHook<T extends 'onSessionStart' | 'onSessionEnd'>(
        hookName: T,
        sessionId: string,
        sessionEventBus: any,
        context: Parameters<NonNullable<PluginHooks[T]>>[0]
    ): Promise<void> {
        // Update context with session-specific data
        const fullContext = {
            ...context,
            sessionId,
            sessionEventBus,
        };

        return this.hookExecutor.executeLifecycleHook(hookName, fullContext);
    }

    /**
     * Get plugin by name
     */
    public getPlugin(name: string): IPlugin | undefined {
        return this.plugins.get(name)?.plugin;
    }

    /**
     * Get all plugins
     */
    public getPlugins(): Map<string, PluginRegistryEntry> {
        return new Map(this.plugins);
    }

    /**
     * Get active plugin count
     */
    public getActivePluginCount(): number {
        return Array.from(this.plugins.values()).filter(
            (entry) => entry.state === PluginState.ACTIVE
        ).length;
    }

    /**
     * Get plugin states
     */
    public getPluginStates(): Map<string, PluginState> {
        const states = new Map<string, PluginState>();
        for (const [name, entry] of this.plugins) {
            states.set(name, entry.state);
        }
        return states;
    }

    /**
     * Check if a plugin is active
     */
    public isPluginActive(name: string): boolean {
        const entry = this.plugins.get(name);
        return entry?.state === PluginState.ACTIVE;
    }

    /**
     * Cleanup all plugins
     */
    public async cleanup(): Promise<void> {
        logger.info('Cleaning up all plugins');

        const cleanupPromises: Promise<void>[] = [];

        for (const [name, entry] of this.plugins) {
            if (entry.plugin && entry.state === PluginState.ACTIVE) {
                cleanupPromises.push(
                    entry.plugin
                        .cleanup()
                        .catch((error) =>
                            logger.error(
                                `Error cleaning up plugin '${name}': ${error instanceof Error ? error.message : String(error)}`
                            )
                        )
                );
            }
        }

        await Promise.allSettled(cleanupPromises);

        this.plugins.clear();
        this.hookExecutor.clear();

        logger.info('Plugin cleanup completed');
    }

    /**
     * Validate plugin interface
     */
    private validatePlugin(plugin: any): void {
        if (!plugin || typeof plugin !== 'object') {
            throw new Error('Plugin must be an object');
        }

        if (typeof plugin.name !== 'string' || !plugin.name) {
            throw new Error('Plugin must have a non-empty name property');
        }

        if (typeof plugin.version !== 'string' || !plugin.version) {
            throw new Error('Plugin must have a non-empty version property');
        }

        if (!plugin.hooks || typeof plugin.hooks !== 'object') {
            throw new Error('Plugin must have a hooks property');
        }

        if (typeof plugin.initialize !== 'function') {
            throw new Error('Plugin must have an initialize method');
        }

        if (typeof plugin.cleanup !== 'function') {
            throw new Error('Plugin must have a cleanup method');
        }
    }

    /**
     * Get configuration base path
     */
    public getConfigBasePath(): string {
        return this.configBasePath;
    }

    /**
     * Update configuration base path
     */
    public setConfigBasePath(path: string): void {
        this.configBasePath = path;
        logger.debug(`Plugin config base path updated to: ${path}`);
    }

    /**
     * Prepare plugin file for loading - compiles TypeScript if needed
     */
    private async preparePluginFile(pluginPath: string): Promise<string> {
        const ext = extname(pluginPath);

        // If it's already a JavaScript file, return as-is
        if (ext === '.js' || ext === '.mjs') {
            return pluginPath;
        }

        // If it's a TypeScript file, compile it
        if (ext === '.ts') {
            return await this.compileTypeScriptPlugin(pluginPath);
        }

        // Unsupported file type
        throw new Error(`Unsupported plugin file type: ${ext}. Supported types: .js, .mjs, .ts`);
    }

    /**
     * Compile TypeScript plugin to JavaScript
     */
    private async compileTypeScriptPlugin(tsPath: string): Promise<string> {
        try {
            // Dynamic import TypeScript compiler
            const ts = await import('typescript').catch(() => {
                throw new Error(
                    'TypeScript is required to load .ts plugins. Run: npm install typescript'
                );
            });

            // Read TypeScript source
            const tsSource = await readFile(tsPath, 'utf-8');

            // Create output directory in .saiki/plugins
            const pluginName = basename(tsPath, '.ts');
            const outputDir = resolve(this.configBasePath, '.saiki', 'plugins');
            const outputPath = resolve(outputDir, `${pluginName}.js`);

            // Ensure output directory exists
            await mkdir(outputDir, { recursive: true });

            // Compile TypeScript to JavaScript
            const compileOptions: any = {
                target: ts.ScriptTarget.ES2022,
                module: ts.ModuleKind.ESNext,
                moduleResolution: ts.ModuleResolutionKind.NodeNext,
                allowSyntheticDefaultImports: true,
                esModuleInterop: true,
                skipLibCheck: true,
                strict: true,
                declaration: false,
                outDir: outputDir,
            };

            // Transform imports to use correct relative paths
            let transformedSource = tsSource;

            // Replace imports from source to dist
            transformedSource = transformedSource.replace(
                /from ['"]\.\.\/src\/core\/([^'"]+)['"];?/g,
                "from '../dist/src/core/$1';"
            );

            // Replace imports from dist to correct relative path from .saiki/plugins
            transformedSource = transformedSource.replace(
                /from ['"]\.\.\/dist\/src\/core\/([^'"]+)['"];?/g,
                "from '../../dist/src/core/$1';"
            );

            const result = ts.transpile(transformedSource, compileOptions, tsPath);

            // Check for compilation errors
            if (!result) {
                throw new Error('TypeScript compilation failed');
            }

            // Write compiled JavaScript
            await writeFile(outputPath, result, 'utf-8');

            logger.debug(`Compiled TypeScript plugin: ${tsPath} → ${outputPath}`);
            return outputPath;
        } catch (error) {
            logger.error(
                `Failed to compile TypeScript plugin ${tsPath}: ${error instanceof Error ? error.message : String(error)}`
            );
            throw new Error(
                `TypeScript compilation failed: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}
