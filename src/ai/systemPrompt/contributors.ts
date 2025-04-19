import { SystemPromptContributor, DynamicContributorContext } from './types.js';

/**
 * StaticContributor: Returns static content for the system prompt.
 */
export class StaticContributor implements SystemPromptContributor {
  readonly id: string;
  readonly priority: number;
  private readonly staticContent: string;

  constructor(id: string, priority: number, content: string) {
    if (!content) {
      throw new Error(`StaticContributor '${id}' requires non-empty content.`);
    }
    this.id = id;
    this.priority = priority;
    this.staticContent = content;
  }

  async getContent(_context: DynamicContributorContext): Promise<string> {
    return this.staticContent;
  }
}

/**
 * DynamicContributor: Uses a handler function to generate content for the system prompt.
 */
export class DynamicContributor implements SystemPromptContributor {
  readonly id: string;
  readonly priority: number;
  private readonly sourceHandler: (context: DynamicContributorContext) => Promise<string>;

  constructor(id: string, priority: number, handler: (context: DynamicContributorContext) => Promise<string>) {
    if (typeof handler !== 'function') {
      throw new Error(`DynamicContributor '${id}' requires a valid handler function.`);
    }
    this.id = id;
    this.priority = priority;
    this.sourceHandler = handler;
  }

  async getContent(context: DynamicContributorContext): Promise<string> {
    return this.sourceHandler(context);
  }
} 