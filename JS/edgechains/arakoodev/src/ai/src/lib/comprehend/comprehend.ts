import {
  ComprehendClient,
  DetectPiiEntitiesCommand,
  LanguageCode,
} from "@aws-sdk/client-comprehend";

interface ComprehendAIConstructionOptions {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  languageCode?: LanguageCode;
}

interface RedactPiiOptions {
  maskMode?: "type" | "character";
  maskCharacter?: string;
}

interface DetectedPiiEntity {
  type?: string;
  score?: number;
  beginOffset?: number;
  endOffset?: number;
}

export class ComprehendAI {
  private client: ComprehendClient;
  private languageCode: LanguageCode;

  constructor(options: ComprehendAIConstructionOptions = {}) {
    const accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey =
      options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;

    this.client = new ComprehendClient({
      region: options.region || process.env.AWS_REGION || "us-east-1",
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
    this.languageCode = options.languageCode || LanguageCode.EN;
  }

  async detectPiiEntities(text: string): Promise<DetectedPiiEntity[]> {
    const response = await this.client.send(
      new DetectPiiEntitiesCommand({
        Text: text,
        LanguageCode: this.languageCode,
      }),
    );
    return (response.Entities || []).map((entity) => ({
      type: entity.Type,
      score: entity.Score,
      beginOffset: entity.BeginOffset,
      endOffset: entity.EndOffset,
    }));
  }

  async redactPii(
    text: string,
    options: RedactPiiOptions = {},
  ): Promise<string> {
    const entities = await this.detectPiiEntities(text);
    let redacted = "";
    let cursor = 0;
    // Reinsert original text before each entity, then its mask
    for (const entity of entities) {
      const begin = entity.beginOffset ?? 0;
      const end = entity.endOffset ?? begin;
      const mask =
        options.maskMode === "character"
          ? (options.maskCharacter || "*").repeat(end - begin)
          : `[${entity.type}]`;
      redacted += text.slice(cursor, begin) + mask;
      cursor = end;
    }
    return redacted + text.slice(cursor);
  }

  // Chainable with Endpoint classes: pass your chat options, get a redacted copy back
  async redact<T extends { prompt?: string }>(options: T): Promise<T> {
    if (options.prompt === undefined) {
      return options;
    }
    return { ...options, prompt: await this.redactPii(options.prompt) };
  }
}
