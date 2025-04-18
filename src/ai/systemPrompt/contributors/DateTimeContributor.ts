import { ISystemPromptContributor, Frequency, PromptContext, SegmentResult } from '../types';

/**
 * Contributor that provides current date and time information to the system prompt.
 */
export class DateTimeContributor implements ISystemPromptContributor {
  readonly name = 'DateTimeContributor';
  readonly frequency: Frequency = 'perMessage';

  async getSegment(_ctx: PromptContext): Promise<SegmentResult> {
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return {
      text: `Current date: ${dateStr}\nCurrent time: ${timeStr} (${tz})`
    };
  }
} 