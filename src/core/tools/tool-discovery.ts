import { promises as fs } from 'fs';
import { resolve, join, extname } from 'path';
import { ToolRegistry } from './tool-registry.js';
import { globalToolRegistry } from './tool-registry.js';
import { Tool, ToolDiscoveryResult, ToolRegistrationError } from './types.js';
import { validateToolDefinition } from './tool-factory.js';
import { logger } from '../logger/index.js';

/**
 * Tool discovery service for file system scanning and loading
 *
 * Handles discovering and loading tools from the file system
 */
export class ToolDiscovery {
    private registry: ToolRegistry;

    constructor(registry: ToolRegistry) {
        this.registry = registry;
    }

    /**
     * Discover tools from directory
     */
    async discoverTools(toolsDirectory: string): Promise<ToolDiscoveryResult> {
        const result: ToolDiscoveryResult = {
            tools: [],
            errors: [],
            warnings: [],
        };

        try {
            const resolvedPath = resolve(toolsDirectory);
            logger.debug(`Discovering tools in: ${resolvedPath}`);

            // Check if directory exists
            try {
                await fs.access(resolvedPath);
            } catch {
                logger.debug(`Tools directory '${resolvedPath}' does not exist, skipping`);
                return result;
            }

            const files = await this.getToolFiles(resolvedPath);

            for (const filePath of files) {
                try {
                    await this.loadToolFile(filePath);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    logger.warn(`Failed to load tool file '${filePath}': ${errorMessage}`);
                    result.errors.push({ filePath, error: errorMessage });
                }
            }

            result.tools = this.registry.getAll();
            logger.info(
                `Tool discovery completed: ${result.tools.length} tools loaded, ${result.errors.length} errors`
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Tool discovery failed: ${errorMessage}`);
            result.errors.push({ filePath: toolsDirectory, error: errorMessage });
        }

        return result;
    }

    /**
     * Load tools from the global registry (decorator-registered)
     */
    async loadRegisteredTools(): Promise<void> {
        const registeredTools = globalToolRegistry.getAll();

        for (const tool of registeredTools) {
            if (validateToolDefinition(tool)) {
                this.registry.register(tool);
            } else {
                logger.warn(`Invalid tool definition for '${tool.id}', skipping`);
            }
        }

        logger.debug(`Loaded ${registeredTools.length} registered tools`);
    }

    /**
     * Get tool files from directory (recursive)
     */
    private async getToolFiles(directory: string): Promise<string[]> {
        const files: string[] = [];
        const entries = await fs.readdir(directory, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = join(directory, entry.name);

            if (entry.isDirectory()) {
                const subFiles = await this.getToolFiles(fullPath);
                files.push(...subFiles);
            } else if (entry.isFile()) {
                const ext = extname(entry.name);
                if (['.ts', '.js', '.mts', '.mjs'].includes(ext)) {
                    files.push(fullPath);
                }
            }
        }

        return files;
    }

    /**
     * Load a tool file and register exported tools
     */
    private async loadToolFile(filePath: string): Promise<void> {
        try {
            logger.debug(`Loading tool file: ${filePath}`);

            const module = await import(`file://${filePath}`);
            let exportedToolsCount = 0;

            for (const [_exportName, exportValue] of Object.entries(module)) {
                // Handle single tool exports
                if (this.isValidToolExport(exportValue)) {
                    const tool = exportValue as Tool;

                    if (validateToolDefinition(tool)) {
                        this.registry.register(tool);
                        exportedToolsCount++;
                        logger.debug(`Registered exported tool: ${tool.id}`);
                    } else {
                        logger.warn(`Invalid tool definition for '${tool.id}' in ${filePath}`);
                    }
                }

                // Handle array exports
                if (Array.isArray(exportValue)) {
                    for (const item of exportValue) {
                        if (this.isValidToolExport(item)) {
                            const tool = item as Tool;

                            if (validateToolDefinition(tool)) {
                                this.registry.register(tool);
                                exportedToolsCount++;
                                logger.debug(`Registered exported tool from array: ${tool.id}`);
                            } else {
                                logger.warn(
                                    `Invalid tool definition for '${tool.id}' in ${filePath}`
                                );
                            }
                        }
                    }
                }
            }

            if (exportedToolsCount > 0) {
                logger.debug(`Loaded ${exportedToolsCount} tools from ${filePath}`);
            } else {
                logger.debug(`No valid tools found in ${filePath}`);
            }
        } catch (error) {
            throw new ToolRegistrationError(
                filePath,
                `Failed to import tool file: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Check if an export value is a valid tool
     */
    private isValidToolExport(exportValue: any): boolean {
        return (
            exportValue &&
            typeof exportValue === 'object' &&
            'id' in exportValue &&
            'execute' in exportValue &&
            'description' in exportValue &&
            'inputSchema' in exportValue
        );
    }

    /**
     * Watch a directory for tool changes (future enhancement)
     */
    async watchDirectory(
        directory: string,
        _callback: (result: ToolDiscoveryResult) => void
    ): Promise<void> {
        // This could be implemented using fs.watch for hot reloading
        // For now, just log that watching is not implemented
        logger.debug(`Tool directory watching not yet implemented for: ${directory}`);
    }

    /**
     * Validate all tools in a directory without loading them
     */
    async validateToolsDirectory(directory: string): Promise<{
        validFiles: string[];
        invalidFiles: Array<{ filePath: string; error: string }>;
    }> {
        const result = {
            validFiles: [] as string[],
            invalidFiles: [] as Array<{ filePath: string; error: string }>,
        };

        try {
            const resolvedPath = resolve(directory);
            const files = await this.getToolFiles(resolvedPath);

            for (const filePath of files) {
                try {
                    // Try to import and validate without registering
                    const module = await import(`file://${filePath}`);
                    let hasValidTools = false;

                    for (const [_exportName, exportValue] of Object.entries(module)) {
                        if (this.isValidToolExport(exportValue)) {
                            const tool = exportValue as Tool;
                            if (validateToolDefinition(tool)) {
                                hasValidTools = true;
                                break;
                            }
                        }
                    }

                    if (hasValidTools) {
                        result.validFiles.push(filePath);
                    } else {
                        result.invalidFiles.push({
                            filePath,
                            error: 'No valid tool exports found',
                        });
                    }
                } catch (error) {
                    result.invalidFiles.push({
                        filePath,
                        error: error instanceof Error ? error.message : String(error),
                    });
                }
            }
        } catch (error) {
            result.invalidFiles.push({
                filePath: directory,
                error: error instanceof Error ? error.message : String(error),
            });
        }

        return result;
    }
}
