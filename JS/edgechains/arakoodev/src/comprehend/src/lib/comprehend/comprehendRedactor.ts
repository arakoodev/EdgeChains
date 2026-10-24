import {
  ComprehendClient,
  DetectPiiEntitiesCommand,
  type LanguageCode,
  type PiiEntity,
} from "@aws-sdk/client-comprehend";

const MAX_COMPREHEND_TEXT_BYTES = 100_000;
const DEFAULT_LANGUAGE_CODE = "en";
const DEFAULT_MASK_CHARACTER = "*";
const DEFAULT_REPLACEMENT_TOKEN = "[{TYPE}]";

export type MaskMode = "REPLACE_WITH_PII_ENTITY_TYPE" | "MASK_WITH_CHAR";

export interface ComprehendCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface RedactionConfig {
  languageCode?: LanguageCode;
  entityTypes?: readonly string[];
  maskMode?: MaskMode;
  maskCharacter?: string;
  replacementToken?: string;
  keepOriginal?: boolean;
}

export interface ComprehendRedactorOptions extends RedactionConfig {
  region?: string;
  credentials?: ComprehendCredentials;
  client?: Pick<ComprehendClient, "send">;
}

export interface RedactionResult {
  redactedText: string;
  entities: readonly PiiEntity[];
  originalText?: string;
}

export interface ChatEndpointLike<TOptions extends object = Record<string, unknown>, TResult = unknown> {
  chat(options: TOptions): Promise<TResult>;
}

export type RedactionListener = (result: RedactionResult) => void;

function credentialsFromEnvironment(): ComprehendCredentials | undefined {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    return undefined;
  }

  return {
    accessKeyId,
    secretAccessKey,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  };
}

function assertSingleCharacter(value: string, optionName: string): void {
  if ([...value].length !== 1) {
    throw new TypeError(`${optionName} must contain exactly one Unicode character.`);
  }
}

function validEntity(entity: PiiEntity, textLength: number): boolean {
  const begin = entity.BeginOffset;
  const end = entity.EndOffset;

  return (
    Number.isInteger(begin) &&
    Number.isInteger(end) &&
    begin !== undefined &&
    end !== undefined &&
    begin >= 0 &&
    end > begin &&
    end <= textLength
  );
}

export class ComprehendPiiRedactor {
  private readonly comprehend: Pick<ComprehendClient, "send">;
  private readonly defaults: Required<
    Pick<RedactionConfig, "languageCode" | "maskMode" | "maskCharacter" | "replacementToken" | "keepOriginal">
  > &
    Pick<RedactionConfig, "entityTypes">;
  private readonly listeners = new Set<RedactionListener>();

  public constructor(options: ComprehendRedactorOptions = {}) {
    const maskCharacter = options.maskCharacter ?? DEFAULT_MASK_CHARACTER;
    assertSingleCharacter(maskCharacter, "maskCharacter");

    if (!(options.replacementToken ?? DEFAULT_REPLACEMENT_TOKEN).includes("{TYPE}")) {
      throw new TypeError('replacementToken must contain the "{TYPE}" token.');
    }

    this.comprehend =
      options.client ??
      new ComprehendClient({
        region: options.region ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION,
        credentials: options.credentials ?? credentialsFromEnvironment(),
      });

    this.defaults = {
      languageCode: options.languageCode ?? DEFAULT_LANGUAGE_CODE,
      entityTypes: options.entityTypes,
      maskMode: options.maskMode ?? "REPLACE_WITH_PII_ENTITY_TYPE",
      maskCharacter,
      replacementToken: options.replacementToken ?? DEFAULT_REPLACEMENT_TOKEN,
      keepOriginal: options.keepOriginal ?? false,
    };
  }

  public subscribe(listener: RedactionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async redact(text: string, overrides: RedactionConfig = {}): Promise<RedactionResult> {
    if (typeof text !== "string") {
      throw new TypeError("text must be a string.");
    }

    const config = {
      ...this.defaults,
      ...overrides,
      entityTypes: overrides.entityTypes ?? this.defaults.entityTypes,
    };

    assertSingleCharacter(config.maskCharacter, "maskCharacter");

    if (!config.replacementToken.includes("{TYPE}")) {
      throw new TypeError('replacementToken must contain the "{TYPE}" token.');
    }

    const entities = await this.detect(text, config.languageCode, config.entityTypes);
    const result = ComprehendPiiRedactor.redactWithEntities(text, entities, config);
    this.notify(result);
    return result;
  }

  public chain<TOptions extends object, TResult>(
    endpoint: ChatEndpointLike<TOptions, TResult>,
  ): RedactionChain<TOptions, TResult> {
    return new RedactionChain(endpoint, this);
  }

  public static redactWithEntities(
    text: string,
    entities: readonly PiiEntity[],
    config: RedactionConfig = {},
  ): RedactionResult {
    const selected = ComprehendPiiRedactor.normalizeEntities(
      entities,
      text.length,
      config.entityTypes,
    );

    const maskMode = config.maskMode ?? "REPLACE_WITH_PII_ENTITY_TYPE";
    const maskCharacter = config.maskCharacter ?? DEFAULT_MASK_CHARACTER;
    const replacementToken = config.replacementToken ?? DEFAULT_REPLACEMENT_TOKEN;

    assertSingleCharacter(maskCharacter, "maskCharacter");

    let redactedText = text;

    for (const entity of [...selected].sort(
      (left, right) => (right.BeginOffset ?? 0) - (left.BeginOffset ?? 0),
    )) {
      const begin = entity.BeginOffset as number;
      const end = entity.EndOffset as number;
      const replacement =
        maskMode === "MASK_WITH_CHAR"
          ? maskCharacter.repeat(end - begin)
          : replacementToken.replaceAll("{TYPE}", entity.Type ?? "PII");

      redactedText = `${redactedText.slice(0, begin)}${replacement}${redactedText.slice(end)}`;
    }

    return {
      redactedText,
      entities: selected,
      ...(config.keepOriginal ? { originalText: text } : {}),
    };
  }

  public static normalizeEntities(
    entities: readonly PiiEntity[],
    textLength: number,
    entityTypes?: readonly string[],
  ): readonly PiiEntity[] {
    const allowedTypes = entityTypes ? new Set(entityTypes) : undefined;

    const sorted = entities
      .filter((entity) => validEntity(entity, textLength))
      .filter((entity) => !allowedTypes || allowedTypes.has(entity.Type ?? ""))
      .slice()
      .sort((left, right) => {
        const startDifference = (left.BeginOffset as number) - (right.BeginOffset as number);
        if (startDifference !== 0) return startDifference;

        const lengthDifference =
          (right.EndOffset as number) -
          (right.BeginOffset as number) -
          ((left.EndOffset as number) - (left.BeginOffset as number));
        if (lengthDifference !== 0) return lengthDifference;

        return (right.Score ?? 0) - (left.Score ?? 0);
      });

    const accepted: PiiEntity[] = [];

    for (const entity of sorted) {
      const previous = accepted.at(-1);

      if (
        previous &&
        (entity.BeginOffset as number) < (previous.EndOffset as number)
      ) {
        continue;
      }

      accepted.push(entity);
    }

    return accepted;
  }

  private async detect(
    text: string,
    languageCode: LanguageCode,
    entityTypes?: readonly string[],
  ): Promise<readonly PiiEntity[]> {
    if (text.length === 0) return [];

    if (new TextEncoder().encode(text).byteLength > MAX_COMPREHEND_TEXT_BYTES) {
      throw new RangeError(
        `Amazon Comprehend accepts at most ${MAX_COMPREHEND_TEXT_BYTES} UTF-8 bytes per request.`,
      );
    }

    const response = await this.comprehend.send(
      new DetectPiiEntitiesCommand({
        Text: text,
        LanguageCode: languageCode,
      }),
    );

    return ComprehendPiiRedactor.normalizeEntities(
      response.Entities ?? [],
      text.length,
      entityTypes,
    );
  }

  private notify(result: RedactionResult): void {
    for (const listener of this.listeners) {
      try {
        listener(result);
      } catch {
        // Observers are non-critical and must not block prompt dispatch.
      }
    }
  }
}

export class RedactionChain<TOptions extends object, TResult> {
  private latest: readonly RedactionResult[] = [];

  public constructor(
    private readonly endpoint: ChatEndpointLike<TOptions, TResult>,
    private readonly redactor: ComprehendPiiRedactor,
  ) {}

  public get redactions(): readonly RedactionResult[] {
    return this.latest;
  }

  public subscribe(listener: RedactionListener): () => void {
    return this.redactor.subscribe(listener);
  }

  public async chat(options: TOptions): Promise<TResult> {
    const mutable = { ...options } as TOptions & {
      prompt?: unknown;
      messages?: unknown;
    };

    const results: RedactionResult[] = [];

    if (typeof mutable.prompt === "string") {
      const result = await this.redactor.redact(mutable.prompt);
      mutable.prompt = result.redactedText;
      results.push(result);
    }

    if (Array.isArray(mutable.messages)) {
      mutable.messages = await Promise.all(
        mutable.messages.map(async (message) => {
          if (
            !message ||
            typeof message !== "object" ||
            typeof (message as { content?: unknown }).content !== "string"
          ) {
            return message;
          }

          const result = await this.redactor.redact(
            (message as { content: string }).content,
          );
          results.push(result);

          return {
            ...(message as Record<string, unknown>),
            content: result.redactedText,
          };
        }),
      );
    }

    this.latest = results;
    return this.endpoint.chat(mutable);
  }
}
