import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { llmConfigSchema } from './schemas.js';
import type { AgentConfig, CLIConfigOverrides, LLMConfig } from './types.js';

/**
 * Validates the general command-line options.
 * @param opts - The command-line options object from commander.
 * @throws {z.ZodError} If validation fails.
 */
export function validateGeneralOptions(opts: any): void {
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
 * ConfigManager encapsulates merging file-based configuration, CLI overrides,
 * default values, validation, and provenance tracking for all configuration
 * sections (e.g., LLM settings, MCP servers, and more).
 *
 * Provenance records the origin of each configuration field—whether the value
 * came from the configuration file, a CLI override, or a default.
 */
export class ConfigManager {
  private resolved: AgentConfig;
  private provenance: { llm: LLMProvenance };

  constructor(fileConfig: AgentConfig) {
    this.resolved = structuredClone(fileConfig);
    this.provenance = { llm: { provider: 'file', model: 'file', router: 'default' } };
    this.applyDefaults();
  }

  private applyDefaults() {
    if (!this.resolved.llm.router) {
      this.resolved.llm.router = 'vercel';
      this.provenance.llm.router = 'default';
    }
  }

  /** Apply CLI overrides and record provenance */
  overrideCLI(cliArgs: CLIConfigOverrides) {
    logger.debug('Applying CLI overrides to LLM config');
    if (cliArgs.provider) {
      this.resolved.llm.provider = cliArgs.provider;
      this.provenance.llm.provider = 'cli';
    }
    if (cliArgs.model) {
      this.resolved.llm.model = cliArgs.model;
      this.provenance.llm.model = 'cli';
    }
    if (cliArgs.router) {
      this.resolved.llm.router = cliArgs.router;
      this.provenance.llm.router = 'cli';
    }
    return this;
  }

  /** Returns the fully resolved AgentConfig */
  getConfig(): AgentConfig {
    return this.resolved;
  }

  /** Returns the provenance map for LLM settings */
  getProvenance(): { llm: LLMProvenance } {
    return this.provenance;
  }

  /** Pretty-print the resolved config and provenance */
  print(): void {
    logger.info('Resolved configuration:');
    logger.info(JSON.stringify(this.resolved, null, 2));
    logger.info('Configuration provenance:');
    for (const [field, src] of Object.entries(this.provenance.llm)) {
      logger.info(`  • ${field}: ${src}`);
    }
  }

  /**
   * Validate resolved config. Throws Error with both schema issues and provenance.
   */
  validate(): void {
    // 1. MCP servers
    if (!this.resolved.mcpServers || Object.keys(this.resolved.mcpServers).length === 0) {
      throw new Error('No MCP server configurations provided in the resolved config.');
    }
    // 2. LLM section sanity
    if (!this.resolved.llm) {
      throw new Error('LLM configuration is missing in the resolved config.');
    }

    // 3. LLM schema via Zod
    try {
      llmConfigSchema.parse(this.resolved.llm);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const issues = err.errors.map(e => {
          const p = e.path.join('.') || 'config';
          return `  • ${p}: ${e.message}`;
        });
        const provLines = Object.entries(this.provenance.llm).map(([field, src]) => {
          const val = (this.resolved.llm as any)[field];
          return `  • ${field}: '${val}' (${src})`;
        });
        throw new Error(`Invalid LLM configuration:\n${issues.join('\n')}\nConfiguration provenance:\n${provLines.join('\n')}`);
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Unexpected error during LLM config validation: ${msg}`);
    }

    logger.debug('LLM config validation successful', 'green');
  }
} 