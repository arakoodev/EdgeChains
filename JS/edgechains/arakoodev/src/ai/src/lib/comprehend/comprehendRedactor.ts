import {
  ComprehendClient,
  DetectPiiEntitiesCommand,
  type DetectPiiEntitiesCommandOutput,
  type PiiEntity,
} from "@aws-sdk/client-comprehend";
import { defer, from, type Observable } from "rxjs";
import { switchMap } from "rxjs/operators";

export type PiiReplacement =
  "entity-type" | "redacted" | string | ((entity: PiiEntity) => string);

export interface AwsComprehendRedactorOptions {
  client?: ComprehendClientLike;
  region?: string;
  languageCode?: string;
  minScore?: number;
  entityTypes?: string[];
  replacement?: PiiReplacement;
  failClosed?: boolean;
}

export interface ComprehendClientLike {
  send(
    command: DetectPiiEntitiesCommand,
  ): Promise<DetectPiiEntitiesCommandOutput>;
}

export interface ChatMessageLike {
  content: string;
  [key: string]: unknown;
}

export interface ChatOptionsLike {
  prompt?: string;
  messages?: ChatMessageLike[];
  [key: string]: unknown;
}

export interface ChatEndpoint<TOptions extends ChatOptionsLike, TResult> {
  chat(options: TOptions): Promise<TResult>;
}

function replacementFor(
  entity: PiiEntity,
  replacement: PiiReplacement,
): string {
  if (typeof replacement === "function") return replacement(entity);
  if (replacement === "entity-type") return `[${entity.Type ?? "PII"}]`;
  if (replacement === "redacted") return "[REDACTED]";
  return replacement;
}

function validSpan(
  entity: PiiEntity,
  length: number,
): entity is PiiEntity & {
  BeginOffset: number;
  EndOffset: number;
} {
  return (
    Number.isInteger(entity.BeginOffset) &&
    Number.isInteger(entity.EndOffset) &&
    (entity.BeginOffset as number) >= 0 &&
    (entity.EndOffset as number) > (entity.BeginOffset as number) &&
    (entity.EndOffset as number) <= length
  );
}

export class AwsComprehendRedactor {
  private readonly client: ComprehendClientLike;
  private readonly languageCode: string;
  private readonly minScore: number;
  private readonly entityTypes?: Set<string>;
  private readonly replacement: PiiReplacement;
  private readonly failClosed: boolean;

  constructor(options: AwsComprehendRedactorOptions = {}) {
    this.client =
      options.client ??
      new ComprehendClient({
        region: options.region ?? process.env.AWS_REGION ?? "us-east-1",
      });
    this.languageCode = options.languageCode ?? "en";
    this.minScore = options.minScore ?? 0;
    this.entityTypes = options.entityTypes
      ? new Set(options.entityTypes.map((type) => type.toUpperCase()))
      : undefined;
    this.replacement = options.replacement ?? "entity-type";
    this.failClosed = options.failClosed ?? true;
  }

  async redact(text: string): Promise<string> {
    if (!text) return text;

    try {
      const response = await this.client.send(
        new DetectPiiEntitiesCommand({
          Text: text,
          LanguageCode: this.languageCode as never,
        }),
      );
      return this.applyEntities(text, response.Entities ?? []);
    } catch (error) {
      if (this.failClosed) throw error;
      return text;
    }
  }

  redact$(text: string): Observable<string> {
    return defer(() => this.redact(text));
  }

  async redactChatOptions<TOptions extends ChatOptionsLike>(
    options: TOptions,
  ): Promise<TOptions> {
    const redacted = { ...options } as TOptions;

    if (typeof options.prompt === "string") {
      redacted.prompt = await this.redact(options.prompt);
    }

    if (options.messages) {
      redacted.messages = await Promise.all(
        options.messages.map(async (message) => ({
          ...message,
          content: await this.redact(message.content),
        })),
      );
    }

    return redacted;
  }

  chat$<TOptions extends ChatOptionsLike, TResult>(
    endpoint: ChatEndpoint<TOptions, TResult>,
    options: TOptions,
  ): Observable<TResult> {
    return defer(() => this.redactChatOptions(options)).pipe(
      switchMap((safeOptions) => from(endpoint.chat(safeOptions))),
    );
  }

  async chat<TOptions extends ChatOptionsLike, TResult>(
    endpoint: ChatEndpoint<TOptions, TResult>,
    options: TOptions,
  ): Promise<TResult> {
    return endpoint.chat(await this.redactChatOptions(options));
  }

  private applyEntities(text: string, entities: PiiEntity[]): string {
    const chars = Array.from(text);
    const eligible = entities
      .filter((entity) => validSpan(entity, chars.length))
      .filter((entity) => (entity.Score ?? 0) >= this.minScore)
      .filter(
        (entity) =>
          !this.entityTypes ||
          (!!entity.Type && this.entityTypes.has(entity.Type.toUpperCase())),
      )
      .sort((a, b) => (b.BeginOffset as number) - (a.BeginOffset as number));

    let upperBound = chars.length;
    for (const entity of eligible) {
      const begin = entity.BeginOffset as number;
      const end = entity.EndOffset as number;
      if (end > upperBound) continue;

      chars.splice(
        begin,
        end - begin,
        replacementFor(entity, this.replacement),
      );
      upperBound = begin;
    }
    return chars.join("");
  }
}
