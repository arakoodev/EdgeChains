import {
  ComprehendClient,
  DetectPiiEntitiesCommand,
  type DetectPiiEntitiesCommandOutput,
  type LanguageCode,
  type PiiEntity,
} from "@aws-sdk/client-comprehend";

type ComprehendClientLike = {
  send(
    command: DetectPiiEntitiesCommand,
  ): Promise<DetectPiiEntitiesCommandOutput>;
};

type PromptMessage = {
  content?: string;
  [key: string]: unknown;
};

type PromptLike = {
  prompt?: string;
  messages?: PromptMessage[];
  [key: string]: unknown;
};

type RedactionReplacement =
  | string
  | ((entity: PiiEntity, value: string) => string);

export interface ComprehendRedactorOptions {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  client?: ComprehendClientLike;
  replacement?: RedactionReplacement;
}

export interface ComprehendDetectionOptions {
  text: string;
  languageCode?: LanguageCode;
}

export interface ComprehendRedactOptions extends ComprehendDetectionOptions {
  replacement?: RedactionReplacement;
}

export interface ComprehendRedactionResult {
  originalText: string;
  redactedText: string;
  entities: PiiEntity[];
}

export class ComprehendRedactor {
  private client: ComprehendClientLike;
  private replacement: RedactionReplacement;

  constructor(options: ComprehendRedactorOptions = {}) {
    this.client = options.client || this.createClient(options);
    this.replacement =
      options.replacement || ((entity) => `[${entity.Type || "PII"}]`);
  }

  async detectPiiEntities(
    options: string | ComprehendDetectionOptions,
  ): Promise<PiiEntity[]> {
    const { text, languageCode } = this.normalizeDetectionOptions(options);

    if (!text.trim()) {
      return [];
    }

    const response = await this.client.send(
      new DetectPiiEntitiesCommand({
        Text: text,
        LanguageCode: languageCode,
      }),
    );

    return response.Entities || [];
  }

  async redact(
    options: string | ComprehendRedactOptions,
  ): Promise<ComprehendRedactionResult> {
    const normalizedOptions = this.normalizeRedactOptions(options);
    const entities = await this.detectPiiEntities(normalizedOptions);

    return {
      originalText: normalizedOptions.text,
      redactedText: this.applyRedactions(
        normalizedOptions.text,
        entities,
        normalizedOptions.replacement || this.replacement,
      ),
      entities,
    };
  }

  async redactText(
    text: string,
    options: Omit<ComprehendRedactOptions, "text"> = {},
  ): Promise<string> {
    const result = await this.redact({ ...options, text });
    return result.redactedText;
  }

  async redactPromptOptions<T extends PromptLike>(
    chatOptions: T,
    options: Omit<ComprehendRedactOptions, "text"> = {},
  ): Promise<T> {
    const redactedOptions = { ...chatOptions };

    if (typeof redactedOptions.prompt === "string") {
      redactedOptions.prompt = await this.redactText(
        redactedOptions.prompt,
        options,
      );
    }

    if (Array.isArray(redactedOptions.messages)) {
      redactedOptions.messages = await Promise.all(
        redactedOptions.messages.map(async (message) => {
          if (typeof message.content !== "string") {
            return message;
          }

          return {
            ...message,
            content: await this.redactText(message.content, options),
          };
        }),
      );
    }

    return redactedOptions as T;
  }

  wrapChat<TOptions extends PromptLike, TResult>(
    endpoint: { chat(options: TOptions): Promise<TResult> | TResult },
    options: Omit<ComprehendRedactOptions, "text"> = {},
  ): { chat(options: TOptions): Promise<TResult> } {
    return {
      chat: async (chatOptions: TOptions) => {
        const redactedOptions = await this.redactPromptOptions(
          chatOptions,
          options,
        );
        return endpoint.chat(redactedOptions);
      },
    };
  }

  private createClient(options: ComprehendRedactorOptions): ComprehendClient {
    const accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey =
      options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
    const sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;

    return new ComprehendClient({
      region:
        options.region ||
        process.env.AWS_REGION ||
        process.env.AWS_DEFAULT_REGION ||
        "us-east-1",
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
              sessionToken,
            }
          : undefined,
    });
  }

  private normalizeDetectionOptions(
    options: string | ComprehendDetectionOptions,
  ): Required<ComprehendDetectionOptions> {
    if (typeof options === "string") {
      return { text: options, languageCode: "en" };
    }

    return {
      text: options.text,
      languageCode: options.languageCode || "en",
    };
  }

  private normalizeRedactOptions(
    options: string | ComprehendRedactOptions,
  ): Required<ComprehendRedactOptions> {
    if (typeof options === "string") {
      return {
        text: options,
        languageCode: "en",
        replacement: this.replacement,
      };
    }

    return {
      text: options.text,
      languageCode: options.languageCode || "en",
      replacement: options.replacement || this.replacement,
    };
  }

  private applyRedactions(
    text: string,
    entities: PiiEntity[],
    replacement: RedactionReplacement,
  ): string {
    return entities
      .filter((entity) => this.isEntityWithOffsets(entity, text))
      .sort((a, b) => (b.BeginOffset || 0) - (a.BeginOffset || 0))
      .reduce((redactedText, entity) => {
        const begin = entity.BeginOffset || 0;
        const end = entity.EndOffset || begin;
        const value = redactedText.slice(begin, end);
        const redactedValue =
          typeof replacement === "function"
            ? replacement(entity, value)
            : replacement;

        return (
          redactedText.slice(0, begin) + redactedValue + redactedText.slice(end)
        );
      }, text);
  }

  private isEntityWithOffsets(entity: PiiEntity, text: string): boolean {
    if (
      typeof entity.BeginOffset !== "number" ||
      typeof entity.EndOffset !== "number"
    ) {
      return false;
    }

    return (
      entity.BeginOffset >= 0 &&
      entity.EndOffset > entity.BeginOffset &&
      entity.EndOffset <= text.length
    );
  }
}
