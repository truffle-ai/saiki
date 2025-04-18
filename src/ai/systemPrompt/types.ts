/**
 * Frequency at which a system prompt segment should be recomputed.
 * - 'perSession': Once per session
 * - 'perMessage': On every message
 * - 'onInterval': At a specified interval (ms)
 */
export type Frequency = 'perSession' | 'perMessage' | 'onInterval';

/**
 * Context provided to each system prompt contributor for segment generation.
 */
export interface PromptContext {
  /** Unique session identifier */
  sessionId: string;
  /** Number of messages in the session */
  messageCount: number;
  /** Timestamp of the last interval-based recomputation (ms since epoch) */
  lastIntervalTs: number;
}

/**
 * Result returned by a system prompt segment contributor.
 */
export interface SegmentResult {
  /** The text of the segment to include in the system prompt */
  text: string;
  /** Optional variables for advanced templating or debugging */
  vars?: Record<string, string>;
}

/**
 * Interface for a system prompt segment contributor.
 */
export interface ISystemPromptContributor {
  /** Unique name for the contributor */
  readonly name: string;
  /** Frequency at which this segment should be recomputed */
  readonly frequency: Frequency;
  /** Optional interval in ms for 'onInterval' frequency */
  readonly intervalMs?: number;
  /**
   * Generate the segment for the system prompt.
   * @param ctx - The current prompt context
   * @returns A promise resolving to the segment result
   */
  getSegment(ctx: PromptContext): Promise<SegmentResult>;
} 