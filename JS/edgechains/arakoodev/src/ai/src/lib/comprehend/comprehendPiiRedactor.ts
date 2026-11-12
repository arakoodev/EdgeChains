import {
  ComprehendClient,
  DetectPiiEntitiesCommand,
  type DetectPiiEntitiesCommandOutput,
  type LanguageCode,
  type PiiEntity,
} from "@aws-sdk/client-comprehend";

export type ComprehendLikeClient = {
  send(
    command: DetectPiiEntitiesCommand,
  ): Promise<DetectPiiEntitiesCommandOutput>;
};

export type RedactionReplacement = "entityType" | "mask";

export interface ComprehendPiiRedactorOptions {
  client?: ComprehendLikeClient;
  region?: string;
  languageCode?: LanguageCode;
  minScore?: number;
  entityTypes?: string[];
  replacement?: RedactionReplacement;
  maskCharacter?: string;
}

export interface RedactableMessage {
  content?: string;
  [key: string]: unknown;
}

export interface RedactableChatOptions {
  prompt?: string;
  messages?: RedactableMessage[];
  [key: string]: unknown;
}

export interface ChatEndpoint<
  TOptions extends RedactableChatOptions = RedactableChatOptions,
  TResult = unknown,
> {
  chat(chatOptions: TOptions): Promise<TResult>;
}

export class ComprehendPiiRedactor {
  private readonly client: ComprehendLikeClient;
  private readonly languageCode: LanguageCode;
  private readonly minScore: number;
  private readonly entityTypes?: Set<string>;
  private readonly replacement: RedactionReplacement;
  private readonly maskCharacter: string;

  constructor(options: ComprehendPiiRedactorOptions = {}) {
    this.client =
      options.client || new ComprehendClient({ region: options.region });
    this.languageCode = options.languageCode || "en";
    this.minScore = options.minScore ?? 0;
    this.entityTypes = options.entityTypes
      ? new Set(options.entityTypes)
      : undefined;
    this.replacement = options.replacement || "entityType";
    this.maskCharacter = options.maskCharacter || "*";
  }

  async detect(text: string): Promise<PiiEntity[]> {
    if (!text) return [];

    const response = await this.client.send(
      new DetectPiiEntitiesCommand({
        Text: text,
        LanguageCode: this.languageCode,
      }),
    );

    return (response.Entities || []).filter((entity) =>
      this.shouldRedact(entity),
    );
  }

  async redact(text: string): Promise<string> {
    if (!text) return text;

    const entities = this.selectNonOverlappingEntities(await this.detect(text));
    let redacted = text;

    for (const entity of entities.sort(
      (a, b) => (b.BeginOffset || 0) - (a.BeginOffset || 0),
    )) {
      const begin = entity.BeginOffset || 0;
      const end = entity.EndOffset || begin;
      const original = redacted.slice(begin, end);
      const replacement =
        this.replacement === "mask"
          ? this.maskCharacter.repeat(original.length)
          : `[${entity.Type || "PII"}]`;

      redacted = redacted.slice(0, begin) + replacement + redacted.slice(end);
    }

    return redacted;
  }

  async redactChatOptions<T extends RedactableChatOptions>(
    chatOptions: T,
  ): Promise<T> {
    const redactedOptions = { ...chatOptions };

    if (typeof chatOptions.prompt === "string") {
      redactedOptions.prompt = await this.redact(chatOptions.prompt);
    }

    if (Array.isArray(chatOptions.messages)) {
      redactedOptions.messages = await Promise.all(
        chatOptions.messages.map(async (message) => {
          if (typeof message.content !== "string") return message;

          return {
            ...message,
            content: await this.redact(message.content),
          };
        }),
      );
    }

    return redactedOptions;
  }

  wrapEndpoint<TOptions extends RedactableChatOptions, TResult>(
    endpoint: ChatEndpoint<TOptions, TResult>,
  ): ChatEndpoint<TOptions, TResult> {
    return {
      chat: async (chatOptions: TOptions) => {
        return endpoint.chat(await this.redactChatOptions(chatOptions));
      },
    };
  }

  asOperator<T extends string | RedactableChatOptions>(): (
    value: T,
  ) => Promise<T> {
    return async (value: T) => {
      if (typeof value === "string") {
        return (await this.redact(value)) as T;
      }

      return this.redactChatOptions(value) as Promise<T>;
    };
  }

  private shouldRedact(entity: PiiEntity): boolean {
    if (entity.BeginOffset === undefined || entity.EndOffset === undefined)
      return false;
    if ((entity.Score ?? 0) < this.minScore) return false;
    if (
      this.entityTypes &&
      (!entity.Type || !this.entityTypes.has(entity.Type))
    )
      return false;
    return true;
  }

  private selectNonOverlappingEntities(entities: PiiEntity[]): PiiEntity[] {
    const selected: PiiEntity[] = [];
    const sorted = [...entities].sort(
      (a, b) => (a.BeginOffset || 0) - (b.BeginOffset || 0),
    );

    for (const entity of sorted) {
      const begin = entity.BeginOffset || 0;
      const end = entity.EndOffset || begin;
      const overlaps = selected.some((selectedEntity) => {
        const selectedBegin = selectedEntity.BeginOffset || 0;
        const selectedEnd = selectedEntity.EndOffset || selectedBegin;
        return begin < selectedEnd && end > selectedBegin;
      });

      if (!overlaps) selected.push(entity);
    }

    return selected;
  }
}
