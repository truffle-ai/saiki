import { ISystemPromptContributor, Frequency, PromptContext, SegmentResult } from '../types';

/**
 * Contributor that provides domain-specific knowledge and capabilities.
 */
export class DomainKnowledgeContributor implements ISystemPromptContributor {
  readonly name = 'DomainKnowledgeContributor';
  readonly frequency: Frequency = 'perSession';

  private readonly domainKnowledge: string;

  /**
   * @param domainKnowledge The domain knowledge text
   */
  constructor(domainKnowledge: string) {
    this.domainKnowledge = domainKnowledge;
  }

  async getSegment(_ctx: PromptContext): Promise<SegmentResult> {
    return { text: this.domainKnowledge };
  }
} 