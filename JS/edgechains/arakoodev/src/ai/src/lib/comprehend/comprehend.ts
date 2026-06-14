import {
  ComprehendClient,
  DetectPiiEntitiesCommand,
} from "@aws-sdk/client-comprehend";

type ChatMessage = {
  role: string;
  content: string;
  name?: string;
};

export type ComprehendPiiEntity = {
  Type?: string;
  BeginOffset?: number;
  EndOffset?: number;
  Score?: number;
};

export type DetectPiiInput = {
  Text: string;
  LanguageCode: string;
};

export type DetectPiiOutput = {
  Entities?: ComprehendPiiEntity[];
};

export type ComprehendCompatibleClient = {
  detectPiiEntities(input: DetectPiiInput): Promise<DetectPiiOutput>;
};

export type ComprehendRedactionMode = "entity" | "mask";

export type ComprehendRedactionOptions = {
  languageCode?: string;
  minScore?: number;
  entityTypes?: string[];
  mode?: ComprehendRedactionMode;
  maskChar?: string;
};

export type ComprehendRedactionResult = {
  originalText: string;
  redactedText: string;
  entities: ComprehendPiiEntity[];
};

export type AWSComprehendPIIRedactorOptions = {
  region?: string;
  languageCode?: string;
  minScore?: number;
  client?: ComprehendCompatibleClient;
};

type ChatEndpoint<TOptions, TResult> = {
  chat(options: TOptions): Promise<TResult>;
};

export class AWSComprehendPIIRedactor {
  private client: ComprehendCompatibleClient;
  private languageCode: string;
  private minScore: number;

  constructor(options: AWSComprehendPIIRedactorOptions = {}) {
    this.client = options.client || createAWSComprehendClient(options.region);
    this.languageCode = options.languageCode || "en";
    this.minScore = options.minScore ?? 0;
  }

  async detectPii(
    text: string,
    options: Pick<ComprehendRedactionOptions, "languageCode"> = {},
  ): Promise<ComprehendPiiEntity[]> {
    if (!text) return [];

    const result = await this.client.detectPiiEntities({
      Text: text,
      LanguageCode: options.languageCode || this.languageCode,
    });

    return result.Entities || [];
  }

  async redact(
    text: string,
    options: ComprehendRedactionOptions = {},
  ): Promise<ComprehendRedactionResult> {
    const entities = await this.detectPii(text, options);
    return {
      originalText: text,
      redactedText: AWSComprehendPIIRedactor.applyRedaction(text, entities, {
        ...options,
        minScore: options.minScore ?? this.minScore,
      }),
      entities,
    };
  }

  async redactMessages(
    messages: ChatMessage[],
    options: ComprehendRedactionOptions = {},
  ): Promise<ChatMessage[]> {
    return await Promise.all(
      messages.map(async (message) => ({
        ...message,
        content: (await this.redact(message.content, options)).redactedText,
      })),
    );
  }

  async redactChatOptions<
    TOptions extends { prompt?: string; messages?: ChatMessage[] },
  >(
    chatOptions: TOptions,
    options: ComprehendRedactionOptions = {},
  ): Promise<TOptions> {
    const redactedOptions = { ...chatOptions };

    if (chatOptions.prompt) {
      redactedOptions.prompt = (
        await this.redact(chatOptions.prompt, options)
      ).redactedText;
    }

    if (chatOptions.messages) {
      redactedOptions.messages = await this.redactMessages(
        chatOptions.messages,
        options,
      );
    }

    return redactedOptions;
  }

  async chat<
    TOptions extends { prompt?: string; messages?: ChatMessage[] },
    TResult,
  >(
    endpoint: ChatEndpoint<TOptions, TResult>,
    chatOptions: TOptions,
    options: ComprehendRedactionOptions = {},
  ): Promise<TResult> {
    return endpoint.chat(await this.redactChatOptions(chatOptions, options));
  }

  wrapChat<
    TOptions extends { prompt?: string; messages?: ChatMessage[] },
    TResult,
  >(
    endpoint: ChatEndpoint<TOptions, TResult>,
    options: ComprehendRedactionOptions = {},
  ): ChatEndpoint<TOptions, TResult> {
    return {
      chat: async (chatOptions: TOptions) =>
        this.chat(endpoint, chatOptions, options),
    };
  }

  static applyRedaction(
    text: string,
    entities: ComprehendPiiEntity[],
    options: ComprehendRedactionOptions = {},
  ): string {
    const codePoints = Array.from(text);
    const minScore = options.minScore ?? 0;
    const allowedTypes = options.entityTypes
      ? new Set(options.entityTypes)
      : undefined;
    const safeEntities = entities
      .filter((entity) => {
        const type = entity.Type || "PII";
        const score = entity.Score ?? 1;
        return (
          typeof entity.BeginOffset === "number" &&
          typeof entity.EndOffset === "number" &&
          entity.BeginOffset >= 0 &&
          entity.EndOffset > entity.BeginOffset &&
          entity.EndOffset <= codePoints.length &&
          score >= minScore &&
          (!allowedTypes || allowedTypes.has(type))
        );
      })
      .sort(
        (left, right) => (right.BeginOffset || 0) - (left.BeginOffset || 0),
      );

    for (const entity of safeEntities) {
      const begin = entity.BeginOffset || 0;
      const end = entity.EndOffset || begin;
      codePoints.splice(begin, end - begin, replacementFor(entity, options));
    }

    return codePoints.join("");
  }
}

function createAWSComprehendClient(
  region?: string,
): ComprehendCompatibleClient {
  const client = new ComprehendClient({
    region: region || process.env.AWS_REGION || "us-east-1",
  });
  return {
    detectPiiEntities: async (input: DetectPiiInput) =>
      await client.send(
        new DetectPiiEntitiesCommand({
          Text: input.Text,
          LanguageCode: input.LanguageCode as any,
        }),
      ),
  };
}

function replacementFor(
  entity: ComprehendPiiEntity,
  options: ComprehendRedactionOptions,
): string {
  const type = entity.Type || "PII";
  if (options.mode === "mask") {
    const width = Math.max(
      (entity.EndOffset || 0) - (entity.BeginOffset || 0),
      1,
    );
    return (options.maskChar || "*").repeat(width);
  }

  return `[${type}]`;
}
