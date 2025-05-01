import { z } from 'zod';
import { logger } from '../utils/logger.js'; 
import {
    getSupportedProviders,
    getSupportedModels,
    isValidProviderModel,
} from '../ai/llm/registry.js'; 
import { AgentConfig, SystemPromptConfig } from './types.js';
import { llmConfigSchema } from './schemas.js';

/**
 * Validates the general command-line options.
 * @param opts - The command-line options object from commander.
 * @throws {z.ZodError} If validation fails.
 */
export function validateGeneralOptions(opts: any): void {
    // Define Zod schema for general options
    logger.debug('Validating general options', 'cyanBright');
    const generalSchema = z.object({
        configFile: z.string().nonempty('Config file path must not be empty'),
        strict: z.boolean().optional().default(false),
        verbose: z.boolean().optional().default(true),
        mode: z.enum(['cli', 'web'], { errorMap: () => ({ message: 'Mode must be either "cli" or "web"' }) }),
        webPort: z.string().refine(
            (val) => {
                const port = parseInt(val, 10);
                return !isNaN(port) && port > 0 && port <= 65535;
            },
            { message: 'Web port must be a number between 1 and 65535' }
        ),
    });

    // Parse and validate the options
    generalSchema.parse({
        configFile: opts.configFile,
        strict: opts.strict,
        verbose: opts.verbose,
        mode: opts.mode.toLowerCase(),
        webPort: opts.webPort,
    });
    logger.debug('General options validated successfully', 'green');
}


/**
 * Validates the fully resolved agent configuration after merging config file and CLI overrides.
 * Also applies default system prompt if necessary.
 * @param config - The resolved AgentConfig object.
 * @throws {Error | z.ZodError} If validation fails.
 */
export function validateResolvedAgentConfig(config: AgentConfig): void {
    logger.debug('Validating resolved agent config', 'cyanBright');
    if (!config.mcpServers || Object.keys(config.mcpServers).length === 0) {
        throw new Error('No MCP server configurations provided in the resolved config.');
    }

    // Validate LLM section
    if (!config.llm) {
        throw new Error('LLM configuration is missing in the resolved config.');
    }

    // Validate the LLM part of the resolved config using Zod
    try {
        llmConfigSchema.parse(config.llm);
    } catch (error) {
         // Re-throw Zod errors to be caught by the main try/catch block
         if (error instanceof z.ZodError) {
            // Construct a more informative error message from Zod issues
            const errorSummary = error.errors.map(e => e.message).join('; ');
            throw new z.ZodError(error.errors); // Re-throw the original Zod error for structured handling
         }
         // Throw other unexpected errors during validation
         throw new Error(`Unexpected error during LLM config validation: ${error}`);
    }

    logger.debug(
        `Found ${Object.keys(config.mcpServers).length} server configurations. Validation successful.`,
        'green'
    );
} 