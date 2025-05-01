import { z } from 'zod';
import type { LLMConfig, AgentConfig, ContributorConfig, SystemPromptConfig } from './types.js';
import { SchemaFromInterface } from '../utils/zod.js';
import { getSupportedProviders, getSupportedModels, isValidProviderModel } from '../ai/llm/registry.js';

export const contributorConfigSchema = z.object({
  id: z.string(),
  type: z.union([z.literal('static'), z.literal('dynamic')]),
  priority: z.number(),
  enabled: z.boolean().optional(),
  content: z.string().optional(),
  source: z.string().optional(),
}) satisfies SchemaFromInterface<ContributorConfig>;

export const systemPromptConfigSchema = z.object({
  contributors: z.array(contributorConfigSchema),
});

// NOTE: We cannot use SchemaFromInterface here because the 'systemPrompt' property is a union type (string | SystemPromptConfig),
// which is not supported by the mapped type utility. This schema must be maintained separately from the LLMConfig interface.
export const llmConfigSchema = z.object({
  provider: z.string(),
  model: z.string(),
  systemPrompt: z.union([z.string(), systemPromptConfigSchema]),
  apiKey: z.string().optional(),
  maxIterations: z.number().optional(),
  providerOptions: z.record(z.any()).optional(),
  router: z.any().optional(),
})
.superRefine((data, ctx) => {
  // 1. Provider must be one of the supported list
  const supportedProviders = getSupportedProviders();
  if (!supportedProviders.includes(data.provider.toLowerCase())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['provider'],
      message: `Provider '${data.provider}' is not supported. Supported: ${supportedProviders.join(', ')}`,
    });
  }
  // 2. Model must be valid for that provider
  const supportedModels = getSupportedModels(data.provider);
  if (!isValidProviderModel(data.provider, data.model)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['model'],
      message: `Model '${data.model}' is not supported for provider '${data.provider}'. Supported: ${supportedModels.join(', ')}`,
    });
  }
});

// You can add more schemas for AgentConfig, etc., as needed. 