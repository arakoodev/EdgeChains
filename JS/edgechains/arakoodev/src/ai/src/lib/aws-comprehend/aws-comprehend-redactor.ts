export type PiiReplacement =
  | string
  | ((entity: ComprehendPiiEntity, originalText: string) => string);

export interface ComprehendPiiEntity {
  Type?: string;
  Score?: number;
  BeginOffset: number;
  EndOffset: number;
}

export interface DetectPiiEntitiesInput {
  Text: string;
  LanguageCode: string;
}

export interface DetectPiiEntitiesOutput {
  Entities?: ComprehendPiiEntity[];
}

export interface ComprehendPiiClient {
  detectPiiEntities(
    input: DetectPiiEntitiesInput,
  ): Promise<DetectPiiEntitiesOutput>;
}

export interface AwsSdkComprehendClient {
  send(command: unknown): Promise<DetectPiiEntitiesOutput>;
}

export interface RedactionMessage {
  content?: string;
  [key: string]: unknown;
}

export interface RedactableChatOptions {
  prompt?: string;
  messages?: RedactionMessage[];
  [key: string]: unknown;
}

export interface ChatEndpoint<TOptions, TResult> {
  chat(options: TOptions): Promise<TResult>;
}

export interface AWSComprehendRedactorOptions {
  client: ComprehendPiiClient;
  languageCode?: string;
  minScore?: number;
  entityTypes?: string[];
  replacement?: PiiReplacement;
}

export interface RedactOptions {
  languageCode?: string;
  minScore?: number;
  entityTypes?: string[];
  replacement?: PiiReplacement;
}

export interface RedactionResult {
  text: string;
  entities: ComprehendPiiEntity[];
}

type DetectPiiEntitiesCommandFactory = new (
  input: DetectPiiEntitiesInput,
) => unknown;

export class AWSComprehendSdkAdapter implements ComprehendPiiClient {
  constructor(
    private readonly client: AwsSdkComprehendClient,
    private readonly DetectPiiEntitiesCommand: DetectPiiEntitiesCommandFactory,
  ) {}

  async detectPiiEntities(
    input: DetectPiiEntitiesInput,
  ): Promise<DetectPiiEntitiesOutput> {
    return await this.client.send(new this.DetectPiiEntitiesCommand(input));
  }
}

export class AWSComprehendRedactor {
  private readonly client: ComprehendPiiClient;
  private readonly languageCode: string;
  private readonly minScore: number;
  private readonly entityTypes?: Set<string>;
  private readonly replacement: PiiReplacement;

  constructor(options: AWSComprehendRedactorOptions) {
    this.client = options.client;
    this.languageCode = options.languageCode || "en";
    this.minScore = options.minScore ?? 0;
    this.entityTypes = options.entityTypes
      ? new Set(options.entityTypes)
      : undefined;
    this.replacement =
      options.replacement || ((entity) => `[${entity.Type || "PII"}]`);
  }

  async detect(
    text: string,
    options: RedactOptions = {},
  ): Promise<ComprehendPiiEntity[]> {
    if (!text) {
      return [];
    }

    const response = await this.client.detectPiiEntities({
      Text: text,
      LanguageCode: options.languageCode || this.languageCode,
    });

    return (response.Entities || [])
      .filter((entity) => this.isEntityEnabled(entity, options))
      .sort((left, right) => left.BeginOffset - right.BeginOffset);
  }

  async redact(
    text: string,
    options: RedactOptions = {},
  ): Promise<RedactionResult> {
    const entities = await this.detect(text, options);
    const replacement = options.replacement || this.replacement;

    const redacted = entities
      .slice()
      .sort((left, right) => right.BeginOffset - left.BeginOffset)
      .reduce((currentText, entity) => {
        const entityText = text.slice(entity.BeginOffset, entity.EndOffset);
        const value =
          typeof replacement === "function"
            ? replacement(entity, entityText)
            : replacement;

        return (
          currentText.slice(0, entity.BeginOffset) +
          value +
          currentText.slice(entity.EndOffset)
        );
      }, text);

    return {
      text: redacted,
      entities,
    };
  }

  async redactChatOptions<TOptions extends RedactableChatOptions>(
    chatOptions: TOptions,
    options: RedactOptions = {},
  ): Promise<TOptions> {
    const redactedOptions: RedactableChatOptions = { ...chatOptions };

    if (typeof chatOptions.prompt === "string") {
      redactedOptions.prompt = (
        await this.redact(chatOptions.prompt, options)
      ).text;
    }

    if (Array.isArray(chatOptions.messages)) {
      redactedOptions.messages = await Promise.all(
        chatOptions.messages.map(async (message) => {
          if (typeof message.content !== "string") {
            return { ...message };
          }

          return {
            ...message,
            content: (await this.redact(message.content, options)).text,
          };
        }),
      );
    }

    return redactedOptions as TOptions;
  }

  async chainChat<TOptions extends RedactableChatOptions, TResult>(
    endpoint: ChatEndpoint<TOptions, TResult>,
    chatOptions: TOptions,
    options: RedactOptions = {},
  ): Promise<TResult> {
    return endpoint.chat(await this.redactChatOptions(chatOptions, options));
  }

  operator<TOptions extends RedactableChatOptions>(
    options: RedactOptions = {},
  ): (chatOptions: TOptions) => Promise<TOptions> {
    return async (chatOptions) => this.redactChatOptions(chatOptions, options);
  }

  private isEntityEnabled(
    entity: ComprehendPiiEntity,
    options: RedactOptions,
  ): boolean {
    const minScore = options.minScore ?? this.minScore;
    const entityTypes = options.entityTypes
      ? new Set(options.entityTypes)
      : this.entityTypes;

    if ((entity.Score ?? 1) < minScore) {
      return false;
    }

    if (entity.BeginOffset < 0 || entity.EndOffset <= entity.BeginOffset) {
      return false;
    }

    if (!entityTypes) {
      return true;
    }

    if (!entity.Type) {
      return false;
    }

    return entityTypes.has(entity.Type);
  }
}
