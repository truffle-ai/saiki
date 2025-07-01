import { ToolModuleDescriptor } from '../config/schemas.js';
import { LocalToolProvider } from '../client/local-tool-provider.js';
import type { ToolProvider } from '../client/types.js';
import { logger } from '../logger/index.js';

/**
 * Dynamically imports modules described in toolModules and converts them to LocalToolProviders.
 * @param descriptors Array of tool module descriptors with absolute paths or npm package names
 */
export async function loadToolModules(
    descriptors: ToolModuleDescriptor[]
): Promise<ToolProvider[]> {
    const providers: ToolProvider[] = [];

    for (let i = 0; i < descriptors.length; i++) {
        const desc = descriptors[i];
        if (!desc) continue;

        try {
            const mod = await import(desc.path);
            let exports: Record<string, any> = {};

            if (desc.export === '*' || desc.export === undefined) {
                exports = mod;
            } else if (desc.export === 'default') {
                exports = { default: mod.default };
            } else {
                exports = { [desc.export]: mod[desc.export] };
            }

            // Filter to functions only
            const fnMap: Record<string, (...args: any[]) => any> = {};
            Object.entries(exports).forEach(([key, val]) => {
                if (typeof val === 'function') {
                    fnMap[key] = val as (...args: any[]) => any;
                }
            });

            if (Object.keys(fnMap).length === 0) {
                logger.warn(
                    `No functions found in module ${desc.path} (export: ${desc.export || '*'})`
                );
                continue;
            }

            const provider = new LocalToolProvider(`local-${i}`, fnMap);
            providers.push(provider);
        } catch (err) {
            logger.error(
                `Failed to load tool module ${desc.path}: ${err instanceof Error ? err.message : String(err)}`
            );
            throw err;
        }
    }

    return providers;
}

/**
 * Convert various ToolInput forms into an array of ToolProvider instances.
 */
export function normalizeToolInput(input: any): ToolProvider[] {
    const providers: ToolProvider[] = [];

    if (!input) return providers;

    // If already an array assume providers or functions
    if (Array.isArray(input)) {
        input.forEach((item, idx) => {
            if (typeof item === 'function') {
                providers.push(
                    new LocalToolProvider(`inline-${idx}`, { [item.name || `fn${idx}`]: item })
                );
            } else {
                providers.push(item as ToolProvider);
            }
        });
        return providers;
    }

    if (typeof input === 'function') {
        providers.push(new LocalToolProvider('inline', { [input.name || 'fn']: input }));
        return providers;
    }

    if (typeof input === 'object') {
        // Record<string, function>
        const fnMap: Record<string, (...args: any[]) => any> = {};
        Object.entries(input).forEach(([key, val]) => {
            if (typeof val === 'function') fnMap[key] = val as (...args: any[]) => any;
        });
        providers.push(new LocalToolProvider('inline-map', fnMap));
        return providers;
    }

    logger.warn('Unsupported tools input type, ignoring');
    return providers;
}
