import { ISystemPromptContributor, Frequency, PromptContext, SegmentResult } from '../types.js';

/**
 * Contributor that provides safety guidelines and ethical boundaries for the AI.
 */
export class SafetyInstructionsContributor implements ISystemPromptContributor {
  readonly name = 'SafetyInstructionsContributor';
  readonly frequency: Frequency = 'perSession';

  private readonly safetyInstructions: string;

  /**
   * @param safetyInstructions The safety instructions text
   */
  constructor(safetyInstructions: string) {
    this.safetyInstructions = safetyInstructions;
  }

  async getSegment(_ctx: PromptContext): Promise<SegmentResult> {
    return { text: this.safetyInstructions };
  }
} 