import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    type DetectPiiEntitiesCommandOutput,
} from "@aws-sdk/client-comprehend";
import { concatMap, from, type OperatorFunction } from "rxjs";

export interface ComprehendClientLike {
    send(command: DetectPiiEntitiesCommand): Promise<DetectPiiEntitiesCommandOutput>;
}

export interface ComprehendRedactorOptions {
    region?: string;
    languageCode?: "en" | "es";
    replacement?: string | ((entityType: string) => string);
    minScore?: number;
    client?: ComprehendClientLike;
}

export interface RedactedEntity {
    type: string;
    score?: number;
    beginOffset: number;
    endOffset: number;
}

export interface RedactionResult {
    text: string;
    entities: RedactedEntity[];
}

export interface RedactableChatOptions {
    prompt?: string;
    messages?: Array<{ content?: string; [key: string]: unknown }>;
}

export interface ChatEndpoint<TOptions extends RedactableChatOptions, TResult> {
    chat(options: TOptions): Promise<TResult>;
}

/**
 * Amazon Comprehend PII redaction for EdgeChains prompts.
 *
 * Use `redactChatOptionsOperator()` in an RxJS pipeline, or `chat()` to redact
 * options immediately before an existing EdgeChains endpoint is called.
 */
export class ComprehendRedactor {
    private readonly client: ComprehendClientLike;
    private readonly languageCode: "en" | "es";
    private readonly replacement: string | ((entityType: string) => string);
    private readonly minScore: number;

    constructor(options: ComprehendRedactorOptions = {}) {
        this.client = options.client ?? new ComprehendClient({
            region: options.region ?? process.env.AWS_REGION ?? "us-east-1",
        });
        this.languageCode = options.languageCode ?? "en";
        this.replacement = options.replacement ?? "[REDACTED]";
        this.minScore = options.minScore ?? 0;
    }

    async detectPii(text: string): Promise<RedactedEntity[]> {
        if (!text) return [];
        const response = await this.client.send(
            new DetectPiiEntitiesCommand({ Text: text, LanguageCode: this.languageCode })
        );

        return (response.Entities ?? [])
            .filter(
                (entity) =>
                    entity.Type &&
                    entity.BeginOffset !== undefined &&
                    entity.EndOffset !== undefined &&
                    (entity.Score ?? 0) >= this.minScore
            )
            .map((entity) => ({
                type: entity.Type!,
                score: entity.Score,
                beginOffset: entity.BeginOffset!,
                endOffset: entity.EndOffset!,
            }));
    }

    async redact(text: string): Promise<RedactionResult> {
        const entities = await this.detectPii(text);
        const redactedText = [...entities]
            .sort((left, right) => right.beginOffset - left.beginOffset)
            .reduce((result, entity) => {
                const replacement = typeof this.replacement === "function"
                    ? this.replacement(entity.type)
                    : this.replacement;
                return result.slice(0, entity.beginOffset) + replacement + result.slice(entity.endOffset);
            }, text);
        return { text: redactedText, entities };
    }

    async redactChatOptions<T extends RedactableChatOptions>(options: T): Promise<T> {
        const redacted = { ...options } as T;
        if (typeof options.prompt === "string") {
            redacted.prompt = (await this.redact(options.prompt)).text;
        }
        if (options.messages) {
            redacted.messages = await Promise.all(
                options.messages.map(async (message) =>
                    typeof message.content === "string"
                        ? { ...message, content: (await this.redact(message.content)).text }
                        : message
                )
            );
        }
        return redacted;
    }

    /** RxJS operator for chainable prompt/message redaction before an endpoint call. */
    redactChatOptionsOperator<T extends RedactableChatOptions>(): OperatorFunction<T, T> {
        return (source) => source.pipe(concatMap((options) => from(this.redactChatOptions(options))));
    }

    /** Redacts chat options before delegating to any EdgeChains-style `chat` endpoint. */
    async chat<TOptions extends RedactableChatOptions, TResult>(
        endpoint: ChatEndpoint<TOptions, TResult>,
        options: TOptions
    ): Promise<TResult> {
        return endpoint.chat(await this.redactChatOptions(options));
    }
}
