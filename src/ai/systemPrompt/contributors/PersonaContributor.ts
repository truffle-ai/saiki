import { ISystemPromptContributor, Frequency, PromptContext, SegmentResult } from '../types.js';

/**
 * Contributor that provides the AI assistant's persona definition.
 */
export class PersonaContributor implements ISystemPromptContributor {
  readonly name = 'PersonaContributor';
  readonly frequency: Frequency = 'perSession';

  private readonly persona: string;

  /**
   * @param persona The persona definition text
   */
  constructor(persona: string) {
    this.persona = persona;
  }

  async getSegment(_ctx: PromptContext): Promise<SegmentResult> {
    return { text: this.persona };
  }
} 