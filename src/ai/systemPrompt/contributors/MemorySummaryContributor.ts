import { ISystemPromptContributor, Frequency, PromptContext, SegmentResult } from '../types.js';

/**
 * Contributor that provides a summary of conversation memory and context.
 */
export class MemorySummaryContributor implements ISystemPromptContributor {
  readonly name = 'MemorySummaryContributor';
  readonly frequency: Frequency = 'onInterval';
  readonly intervalMs: number;

  private readonly getMemorySummary: () => Promise<string>;

  /**
   * @param getMemorySummary Function to retrieve conversation memory summary
   * @param intervalMs Interval in ms for recomputation (default: 5 minutes)
   */
  constructor(getMemorySummary: () => Promise<string>, intervalMs: number = 5 * 60 * 1000) {
    this.getMemorySummary = getMemorySummary;
    this.intervalMs = intervalMs;
  }

  async getSegment(_ctx: PromptContext): Promise<SegmentResult> {
    const summary = await this.getMemorySummary();
    return { text: summary };
  }
} 