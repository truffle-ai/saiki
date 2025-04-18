import { ISystemPromptContributor, PromptContext, SegmentResult, Frequency } from './types.js';

/**
 * SystemPromptBuilder assembles the system prompt from registered contributors,
 * manages caching by frequency, and provides methods to add/remove contributors.
 */
export class SystemPromptBuilder {
  private contributors: ISystemPromptContributor[] = [];
  private perSessionCache: Map<string, SegmentResult> = new Map();
  private perMessageCache: Map<string, SegmentResult> = new Map();
  private intervalCache: Map<string, { result: SegmentResult; lastComputed: number; intervalMs: number }> = new Map();

  /**
   * @param contributors Initial list of system prompt contributors
   */
  constructor(contributors: ISystemPromptContributor[] = []) {
    this.contributors = [...contributors];
  }

  /**
   * Add a new contributor to the builder.
   * @param contributor The contributor to add
   */
  addContributor(contributor: ISystemPromptContributor) {
    this.contributors.push(contributor);
  }

  /**
   * Remove a contributor by name.
   * @param name The name of the contributor to remove
   */
  removeContributor(name: string) {
    this.contributors = this.contributors.filter(c => c.name !== name);
    this.perSessionCache.delete(name);
    this.perMessageCache.delete(name);
    this.intervalCache.delete(name);
  }

  /**
   * Invalidate all per-session caches (e.g., on session reset)
   */
  invalidateSessionCache() {
    this.perSessionCache.clear();
  }

  /**
   * Invalidate all per-message caches (should be called before each message)
   */
  invalidateMessageCache() {
    this.perMessageCache.clear();
  }

  /**
   * Invalidate all interval caches (e.g., on forced refresh)
   */
  invalidateIntervalCache() {
    this.intervalCache.clear();
  }

  /**
   * Build the final system prompt string by assembling all contributor segments.
   * Handles caching and error isolation for each contributor.
   * @param context The current prompt context
   * @returns The assembled system prompt string
   */
  async buildPrompt(context: PromptContext): Promise<string> {
    const segments: string[] = [];
    const now = Date.now();

    for (const contributor of this.contributors) {
      try {
        let segment: SegmentResult | undefined;
        switch (contributor.frequency) {
          case 'perSession': {
            if (!this.perSessionCache.has(contributor.name)) {
              segment = await contributor.getSegment(context);
              this.perSessionCache.set(contributor.name, segment);
            } else {
              segment = this.perSessionCache.get(contributor.name);
            }
            break;
          }
          case 'perMessage': {
            // Always recompute
            segment = await contributor.getSegment(context);
            this.perMessageCache.set(contributor.name, segment);
            break;
          }
          case 'onInterval': {
            const cache = this.intervalCache.get(contributor.name);
            const intervalMs = contributor.intervalMs ?? 300000; // default 5 min
            if (!cache || now - cache.lastComputed > intervalMs) {
              segment = await contributor.getSegment(context);
              this.intervalCache.set(contributor.name, { result: segment, lastComputed: now, intervalMs });
            } else {
              segment = cache.result;
            }
            break;
          }
        }
        if (segment) segments.push(segment.text);
      } catch (err) {
        // Log error and skip this segment
        // (Replace with your logger if available)
        console.error(`SystemPromptBuilder: Error in contributor '${contributor.name}':`, err);
      }
    }
    return segments.join('\n');
  }
} 