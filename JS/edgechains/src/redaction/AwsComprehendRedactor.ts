// AwsComprehendRedactor.ts - Observable PII Redaction Endpoint for EdgeChains JS SDK (Fixes #290)
import { ComprehendClient, DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";

export interface AwsComprehendRedactorOptions {
  region?: string;
  languageCode?: "en" | "es" | "fr" | "de" | "it" | "pt" | "ar" | "hi" | "ja" | "ko" | "zh" | "zh-TW";
  confidenceThreshold?: number;
  entityTypesToRedact?: string[];
  client?: ComprehendClient;
}

export class AwsComprehendRedactor {
  private client: ComprehendClient;
  private languageCode: "en" | "es" | "fr" | "de" | "it" | "pt" | "ar" | "hi" | "ja" | "ko" | "zh" | "zh-TW";
  private confidenceThreshold: number;
  private entityTypesToRedact?: Set<string>;

  constructor(options: AwsComprehendRedactorOptions = {}) {
    this.client = options.client ?? new ComprehendClient({ region: options.region ?? process.env.AWS_REGION ?? "us-east-1" });
    this.languageCode = options.languageCode ?? "en";
    this.confidenceThreshold = options.confidenceThreshold ?? 0.5;
    if (options.entityTypesToRedact?.length) {
      this.entityTypesToRedact = new Set(options.entityTypesToRedact);
    }
  }

  async redactText(prompt: string): Promise<{ redactedText: string; entitiesFound: number }> {
    if (!prompt || !prompt.trim()) {
      return { redactedText: prompt, entitiesFound: 0 };
    }
    const cmd = new DetectPiiEntitiesCommand({
      Text: prompt,
      LanguageCode: this.languageCode,
    });
    const response = await this.client.send(cmd);
    const entities = (response.Entities ?? [])
      .filter((e) => (e.Score ?? 0) >= this.confidenceThreshold)
      .filter((e) => !this.entityTypesToRedact || (e.Type && this.entityTypesToRedact.has(e.Type)))
      .sort((a, b) => (b.BeginOffset ?? 0) - (a.BeginOffset ?? 0));

    let redacted = prompt;
    for (const ent of entities) {
      const start = ent.BeginOffset ?? 0;
      const end = ent.EndOffset ?? start;
      if (end > start && start >= 0 && end <= redacted.length) {
        const replacement = `[REDACTED_${ent.Type ?? "PII"}]`;
        redacted = redacted.slice(0, start) + replacement + redacted.slice(end);
      }
    }
    return { redactedText: redacted, entitiesFound: entities.length };
  }
}
