import { ISystemPromptContributor } from './types.js';
import { SystemPromptBuilder } from './SystemPromptBuilder.js';

/**
 * Singleton registry for system prompt contributors.
 */
export class SystemPromptRegistry {
  private static instance: SystemPromptRegistry;
  private contributors: ISystemPromptContributor[] = [];

  private constructor() {}

  // TODO: Integrate SystemPromptRegistry into the application initialization process.
  // This registry is intended to manage system prompt contributors dynamically,
  // potentially loaded from configuration or plugins in the future.

  /**
   * Get the singleton instance of the registry.
   */
  static getInstance(): SystemPromptRegistry {
    if (!SystemPromptRegistry.instance) {
      SystemPromptRegistry.instance = new SystemPromptRegistry();
    }
    return SystemPromptRegistry.instance;
  }

  /**
   * Register a new contributor.
   */
  register(contributor: ISystemPromptContributor): void {
    this.contributors.push(contributor);
  }

  /**
   * Unregister a contributor by name.
   */
  unregister(name: string): void {
    this.contributors = this.contributors.filter(c => c.name !== name);
  }

  /**
   * Get all registered contributors.
   */
  getContributors(): ISystemPromptContributor[] {
    return [...this.contributors];
  }

  /**
   * Clear all contributors.
   */
  clear(): void {
    this.contributors = [];
  }

  /**
   * Create a SystemPromptBuilder with the current contributors.
   */
  createBuilder(): SystemPromptBuilder {
    return new SystemPromptBuilder(this.getContributors());
  }
} 