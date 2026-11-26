import {
  ComprehendClient,
  DetectPiiEntitiesCommand,
  type LanguageCode,
  type PiiEntity,
  type PiiEntityType,
} from "@aws-sdk/client-comprehend";
import { ComprehendRedactedEndpoint } from "./redactedEndpoint.js";

interface AwsComprehendConstructionOptions {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  /**
   * Provide a pre-built Comprehend client (useful for tests or when the
   * caller manages the AWS SDK lifecycle itself). When omitted, a client
   * is created from the region/credential options above.
   */
  client?: ComprehendClient;
}

interface DetectPiiOptions {
  languageCode?: LanguageCode;
}

type PiiMaskStyle = "label" | "character" | "fixed";

interface RedactPiiOptions extends DetectPiiOptions {
  /**
   * How detected entities are replaced in the text:
   * - "label" (default): the span becomes `[ENTITY_TYPE]`, e.g. `[EMAIL]`
   * - "character": the span becomes `maskChar` repeated to the span length
   * - "fixed": the span becomes the fixed `replacement` string
   */
  maskStyle?: PiiMaskStyle;
  maskChar?: string;
  replacement?: string;
  /** Only redact these entity types; everything else is left untouched. */
  entityTypes?: PiiEntityType[];
  /** Only redact entities detected with at least this confidence (0-1). */
  minScore?: number;
}

interface RedactPiiReturnOptions {
  redactedText: string;
  entities: PiiEntity[];
}

interface messageOption {
  role: string;
  content: string;
  name?: string;
}

export type { PiiEntity, PiiEntityType };

/**
 * Utility class that uses Amazon Comprehend to detect personally
 * identifiable information (PII) in prompts and redact it before the
 * prompt is sent to an LLM endpoint.
 *
 * Redaction follows the pattern from the AWS machine-learning blog
 * ("Detecting and redacting PII using Amazon Comprehend"): entities are
 * located with `DetectPiiEntities` and the matching spans of the original
 * text are then replaced locally, so the sensitive values never leave
 * this process.
 */
export class AwsComprehend {
  client: ComprehendClient;
  region: string;

  constructor(options: AwsComprehendConstructionOptions = {}) {
    this.region =
      options.region ||
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION ||
      "";
    if (options.client) {
      this.client = options.client;
    } else {
      this.checkConfig();
      this.client = new ComprehendClient({
        region: this.region || undefined,
        credentials:
          options.accessKeyId && options.secretAccessKey
            ? {
                accessKeyId: options.accessKeyId,
                secretAccessKey: options.secretAccessKey,
                sessionToken: options.sessionToken,
              }
            : undefined,
      });
    }
  }

  private checkConfig(): void {
    if (!this.region) {
      console.warn(
        "AWS region is missing. Please provide a region or add it in .env file as AWS_REGION",
      );
    }
  }

  async detectPiiEntities(
    text: string,
    detectOptions: DetectPiiOptions = {},
  ): Promise<PiiEntity[]> {
    const response = await this.client.send(
      new DetectPiiEntitiesCommand({
        Text: text,
        LanguageCode: detectOptions.languageCode || "en",
      }),
    );
    return response.Entities || [];
  }

  async redactPii(
    text: string,
    redactOptions: RedactPiiOptions = {},
  ): Promise<RedactPiiReturnOptions> {
    const detected = await this.detectPiiEntities(text, redactOptions);
    const entities = detected.filter((entity) => {
      if (
        redactOptions.entityTypes &&
        entity.Type &&
        !redactOptions.entityTypes.includes(entity.Type)
      ) {
        return false;
      }
      if (
        redactOptions.minScore &&
        (entity.Score || 0) < redactOptions.minScore
      ) {
        return false;
      }
      return entity.BeginOffset !== undefined && entity.EndOffset !== undefined;
    });

    // Replace spans from the end of the text backwards so that the
    // offsets of the remaining entities stay valid while editing.
    const sorted = [...entities].sort(
      (a, b) => (b.BeginOffset || 0) - (a.BeginOffset || 0),
    );
    let redactedText = text;
    for (const entity of sorted) {
      const mask = this.maskFor(entity, redactOptions);
      redactedText =
        redactedText.slice(0, entity.BeginOffset) +
        mask +
        redactedText.slice(entity.EndOffset);
    }
    return { redactedText, entities };
  }

  private maskFor(entity: PiiEntity, redactOptions: RedactPiiOptions): string {
    const style = redactOptions.maskStyle || "label";
    if (style === "character") {
      const length = (entity.EndOffset || 0) - (entity.BeginOffset || 0);
      return (redactOptions.maskChar || "*").repeat(length);
    }
    if (style === "fixed") {
      return redactOptions.replacement || "[REDACTED]";
    }
    return `[${entity.Type || "PII"}]`;
  }

  async redactMessages(
    messages: messageOption[],
    redactOptions: RedactPiiOptions = {},
  ): Promise<messageOption[]> {
    const redactedMessages: messageOption[] = [];
    for (const message of messages) {
      const { redactedText } = await this.redactPii(
        message.content,
        redactOptions,
      );
      redactedMessages.push({ ...message, content: redactedText });
    }
    return redactedMessages;
  }

  /**
   * Chain this redactor with an existing Endpoint class (OpenAI,
   * GeminiAI, LlamaAI, ...). Returns an endpoint with the same `chat`
   * method whose prompt/messages are redacted before they reach the
   * wrapped endpoint.
   */
  chain<T extends { chat: (options: any) => Promise<any> }>(
    endpoint: T,
  ): ComprehendRedactedEndpoint<T> {
    return new ComprehendRedactedEndpoint(endpoint, this);
  }
}
