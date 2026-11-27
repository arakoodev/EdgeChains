/**
 * EdgeChains Utility: AWS Comprehend PII Redaction Utility
 * Allows chaining with EdgeChains Endpoint observables to automatically detect and redact
 * sensitive Personally Identifiable Information (PII) before sending prompts to LLMs.
 */

export interface PiiEntity {
  Score?: number;
  Type?: string;
  BeginOffset?: number;
  EndOffset?: number;
}

export interface ComprehendRedactorOptions {
  region?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  languageCode?: string;
  maskMode?: 'ENTITY_TYPE' | 'ASTERISKS' | 'CUSTOM';
  customMask?: string;
  confidenceThreshold?: number;
}

export class AwsComprehendRedactor {
  private options: ComprehendRedactorOptions;

  constructor(options: ComprehendRedactorOptions = {}) {
    this.options = {
      region: options.region || 'us-east-1',
      languageCode: options.languageCode || 'en',
      maskMode: options.maskMode || 'ENTITY_TYPE',
      customMask: options.customMask || '[REDACTED]',
      confidenceThreshold: options.confidenceThreshold || 0.8,
      credentials: options.credentials
    };
  }

  /**
   * Redacts PII entities in a text string based on detected offsets.
   */
  public redactPiiSync(text: string, entities: PiiEntity[]): string {
    if (!text || !entities || entities.length === 0) {
      return text;
    }

    // Filter by confidence score and sort entities in descending order of BeginOffset
    // to avoid offset misalignment during in-place string replacement
    const validEntities = entities
      .filter(e => (e.Score ?? 1.0) >= (this.options.confidenceThreshold || 0.8))
      .sort((a, b) => (b.BeginOffset ?? 0) - (a.BeginOffset ?? 0));

    let sanitized = text;

    for (const entity of validEntities) {
      const start = entity.BeginOffset ?? 0;
      const end = entity.EndOffset ?? 0;

      if (start >= 0 && end <= sanitized.length && start < end) {
        let mask = this.options.customMask || '[REDACTED]';
        if (this.options.maskMode === 'ENTITY_TYPE') {
          mask = `[REDACTED_${entity.Type || 'PII'}]`;
        } else if (this.options.maskMode === 'ASTERISKS') {
          mask = '*'.repeat(end - start);
        }

        sanitized = sanitized.slice(0, start) + mask + sanitized.slice(end);
      }
    }

    return sanitized;
  }

  /**
   * Observable / Chainable Operator:
   * Maps an input prompt stream through the PII redactor.
   */
  public createPipeOperator() {
    return async (inputPrompt: string, detectEntitiesFn?: (text: string) => Promise<PiiEntity[]>): Promise<string> => {
      if (!inputPrompt) return inputPrompt;
      const entities = detectEntitiesFn ? await detectEntitiesFn(inputPrompt) : [];
      return this.redactPiiSync(inputPrompt, entities);
    };
  }
}
