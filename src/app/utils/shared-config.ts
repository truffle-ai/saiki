import { existsSync } from 'fs';
import { logger, DEFAULT_CONFIG_PATH, resolvePackagePath, loadConfigFile } from '@core/index.js';

export interface SharedConfigOptions {
    configFile?: string;
    strict?: boolean;
}

/**
 * Shared configuration loading logic that can be used by both main command and subcommands
 */
export async function loadSharedConfig(opts: SharedConfigOptions) {
    // Validate environment
    if (!existsSync('.env')) {
        logger.debug('WARNING: .env file not found; copy .env.example and set your API keys.');
    }

    // Load and resolve config
    const configPath = resolvePackagePath(
        opts.configFile || DEFAULT_CONFIG_PATH,
        (opts.configFile || DEFAULT_CONFIG_PATH) === DEFAULT_CONFIG_PATH
    );

    logger.info(`Loading Saiki config from: ${configPath}`);
    const config = await loadConfigFile(configPath);

    return { config, configPath };
}
