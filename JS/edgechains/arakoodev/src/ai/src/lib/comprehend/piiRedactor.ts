/**
 * AWS Comprehend PII redaction utility for EdgeChains (issue #290).
 *
 * Chainable helper: detect PII entities then replace spans with [REDACTED_*].
 * Inject a `detectPii` function for tests; production uses AWS Comprehend
 * when credentials are available.
 */

export type PiiEntity = {
  Type: string;
  BeginOffset: number;
  EndOffset: number;
  Score?: number;
};

export type DetectPiiFn = (text: string) => Promise<PiiEntity[]>;

export type RedactOptions = {
  /** Minimum confidence score to redact (default 0.5). */
  minScore?: number;
  /** Optional override for the detector (tests / alternate backends). */
  detectPii?: DetectPiiFn;
  /**
   * AWS region for Comprehend (default us-east-1).
   * Only used when `detectPii` is not provided.
   */
  region?: string;
};

/**
 * Chainable PII redactor.
 *
 * @example
 * ```ts
 * const redactor = new ComprehendPiiRedactor({ detectPii: mockDetect });
 * const clean = await redactor.redact("Call me at 555-0100");
 * // "Call me at [REDACTED_PHONE]"
 * ```
 */
export class ComprehendPiiRedactor {
  private minScore: number;
  private detectPii: DetectPiiFn;
  private region: string;

  constructor(options: RedactOptions = {}) {
    this.minScore = options.minScore ?? 0.5;
    this.region = options.region ?? process.env.AWS_REGION ?? "us-east-1";
    this.detectPii = options.detectPii ?? this.defaultComprehendDetect.bind(this);
  }

  /**
   * Detect and redact PII in `text`. Returns a new string (input is not mutated).
   */
  async redact(text: string): Promise<string> {
    if (!text) return text;
    const entities = await this.detectPii(text);
    return this.applyRedactions(text, entities);
  }

  /**
   * Observable-style chain helper: map a prompt string through redaction.
   * Works with arrays of messages for multi-turn prompts.
   */
  async redactMessages(
    messages: Array<{ role: string; content: string }>,
  ): Promise<Array<{ role: string; content: string }>> {
    const out = [];
    for (const m of messages) {
      out.push({ role: m.role, content: await this.redact(m.content) });
    }
    return out;
  }

  /**
   * Apply entity spans right-to-left so offsets stay valid.
   */
  applyRedactions(text: string, entities: PiiEntity[]): string {
    const filtered = entities
      .filter((e) => (e.Score ?? 1) >= this.minScore)
      .slice()
      .sort((a, b) => b.BeginOffset - a.BeginOffset);

    let result = text;
    for (const e of filtered) {
      const label = `[REDACTED_${(e.Type || "PII").toUpperCase()}]`;
      result = result.slice(0, e.BeginOffset) + label + result.slice(e.EndOffset);
    }
    return result;
  }

  /**
   * Production path: call AWS Comprehend DetectPiiEntities.
   * Uses dynamic import so the package is optional at install time.
   */
  private async defaultComprehendDetect(text: string): Promise<PiiEntity[]> {
    try {
      // @ts-expect-error optional peer dependency
      const { ComprehendClient, DetectPiiEntitiesCommand } = await import(
        "@aws-sdk/client-comprehend"
      );
      const client = new ComprehendClient({ region: this.region });
      const resp = await client.send(
        new DetectPiiEntitiesCommand({ Text: text, LanguageCode: "en" }),
      );
      return (resp.Entities || []).map((e: { Type?: string; BeginOffset?: number; EndOffset?: number; Score?: number }) => ({
        Type: e.Type || "PII",
        BeginOffset: e.BeginOffset ?? 0,
        EndOffset: e.EndOffset ?? 0,
        Score: e.Score,
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Comprehend detect failed (install @aws-sdk/client-comprehend and set AWS credentials): ${msg}`,
      );
    }
  }
}

/**
 * Factory for chaining: `const redactor = createPiiRedactor({ detectPii })`
 */
export function createPiiRedactor(options?: RedactOptions): ComprehendPiiRedactor {
  return new ComprehendPiiRedactor(options);
}
