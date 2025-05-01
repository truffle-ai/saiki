import { z } from 'zod';
import { logger } from './logger.js';
import { getSupportedProviders, getSupportedModels } from '../ai/llm/registry.js';

/**
 * Validates the command-line options.
 * @param opts - The command-line options object from commander.
 * @throws {z.ZodError} If validation fails.
 */
export function validateCliOptions(opts: any): void {
  logger.debug('Validating command-line options', 'cyanBright');

  const supportedProviders = getSupportedProviders().map(p => p.toLowerCase());

  // Base schema for primitive shape
  const base = z.object({
    configFile: z.string().nonempty('Config file path must not be empty'),
    strict: z.boolean().optional().default(false),
    verbose: z.boolean().optional().default(true),
    mode: z.enum(['cli', 'web'], {
      errorMap: () => ({ message: 'Mode must be either "cli" or "web"' }),
    }),
    webPort: z
      .string()
      .refine(val => {
        const port = parseInt(val, 10);
        return !isNaN(port) && port > 0 && port <= 65535;
      }, { message: 'Web port must be a number between 1 and 65535' }),
    provider: z.string().optional(),
    model: z.string().optional(),
    router: z.enum(['vercel', 'default']).optional(),
  });

  // Add semantic refinements
  const generalSchema = base
    // 1) provider must be one of the supported set if provided
    .refine(
      data => !data.provider || supportedProviders.includes(data.provider.toLowerCase()),
      {
        path: ['provider'],
        message: `Provider must be one of: ${supportedProviders.join(', ')}`,
      }
    )
    // 2) if model is provided, provider must also be provided and model must exist for that provider
    .refine(
      data => {
        if (!data.model) return true;
        if (!data.provider) return false;
        return getSupportedModels(data.provider.toLowerCase())
          .map(m => m.toLowerCase())
          .includes(data.model.toLowerCase());
      },
      {
        path: ['model'],
        message: `Model must be one of the supported models for the given provider.`,
      }
    );

  // Execute validation
  generalSchema.parse({
    configFile: opts.configFile,
    strict: opts.strict,
    verbose: opts.verbose,
    mode: opts.mode.toLowerCase(),
    webPort: opts.webPort,
    provider: opts.provider,
    model: opts.model,
    router: opts.router,
  });

  logger.debug('Command-line options validated successfully', 'green');
} 