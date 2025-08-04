import { z } from 'zod';
import { logger } from '../logger/index.js';
import { AgentConfigSchema } from '@core/agent/schemas.js';
import type { ValidatedAgentConfig, AgentConfig } from '@core/agent/schemas.js';

/**
 * ConfigManager: Handles pure configuration validation and access for the core layer.
 *
 * This class manages configuration that is already processed and focuses purely on
 * validation and read-only access to configuration.
 *
 * **What this handles:**
 * - Configuration validation using Zod schemas
 * - Read-only access to processed configuration
 * - Schema default application
 * - Immutability protection
 *
 * **What this does NOT handle (moved to app layer):**
 * - CLI argument processing
 * - Configuration merging logic
 */
export class ConfigManager {
    private readonly config: ValidatedAgentConfig;

    constructor(config: AgentConfig) {
        logger.debug('Loading agent configuration...');

        // Validate and apply schema defaults
        const validatedConfig = this.validateAndApplyDefaults(config);

        // Store immutable config
        this.config = Object.freeze(validatedConfig);

        logger.info('Agent configuration loaded and validated.');
    }

    /**
     * Validates the configuration against the schema and applies defaults.
     * @param config Raw configuration object
     * @returns Validated configuration with defaults applied
     */
    private validateAndApplyDefaults(config: AgentConfig): ValidatedAgentConfig {
        try {
            logger.debug('Agent configuration validation successful');
            return AgentConfigSchema.parse(config);
        } catch (error) {
            logger.error('Validation failed for agent configuration');

            if (error instanceof z.ZodError) {
                const issues = error.issues
                    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                    .join(', ');
                throw new Error(`Configuration validation failed: ${issues}`);
            }
            throw error;
        }
    }

    /**
     * Gets the validated configuration (read-only).
     * @returns Immutable configuration object
     */
    public getConfig(): Readonly<ValidatedAgentConfig> {
        return this.config;
    }
}
