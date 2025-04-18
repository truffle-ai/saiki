import { ISystemPromptContributor, Frequency, PromptContext, SegmentResult } from '../types.js';

/**
 * Contributor that provides the legacy static system prompt for backward compatibility.
 */
export class OriginalPromptContributor implements ISystemPromptContributor {
  readonly name = 'OriginalPromptContributor';
  readonly frequency: Frequency = 'perSession';

  private readonly prompt: string;

  /**
   * @param prompt The legacy static system prompt text
   */
  constructor(prompt: string) {
    this.prompt = prompt;
  }

  async getSegment(_ctx: PromptContext): Promise<SegmentResult> {
    return { text: this.prompt };
  }
} 