import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    LanguageCode,
    type DetectPiiEntitiesCommandOutput,
    type PiiEntity,
} from "@aws-sdk/client-comprehend";
import { Observable, concatMap, type OperatorFunction } from "rxjs";

export interface ComprehendClientLike {
    send(
        command: DetectPiiEntitiesCommand,
        options?: { abortSignal?: AbortSignal }
    ): Promise<DetectPiiEntitiesCommandOutput>;
}

export interface ComprehendPiiRedactorOptions {
    client?: ComprehendClientLike;
    region?: string;
    languageCode?: LanguageCode;
    minScore?: number;
    replacement?: "label" | "mask";
    maskCharacter?: string;
}

export interface RedactableChatOptions {
    prompt?: string;
    messages?: Array<{ content?: string; [key: string]: unknown }>;
    [key: string]: unknown;
}

export interface ChatEndpoint<Options extends RedactableChatOptions, Result> {
    chat(options: Options): Promise<Result>;
}

export class ComprehendPiiRedactor {
    private readonly client: ComprehendClientLike;
    private readonly languageCode: LanguageCode;
    private readonly minScore: number;
    private readonly replacement: "label" | "mask";
    private readonly maskCharacter: string;

    constructor(options: ComprehendPiiRedactorOptions = {}) {
        this.client =
            options.client ||
            (new ComprehendClient({
                region: options.region,
            }) as ComprehendClientLike);
        this.languageCode = options.languageCode || LanguageCode.EN;
        this.minScore = options.minScore ?? 0;
        this.replacement = options.replacement || "label";
        this.maskCharacter = options.maskCharacter || "*";
    }

    async redact(text: string, abortSignal?: AbortSignal): Promise<string> {
        if (!text) return text;
        if (new TextEncoder().encode(text).byteLength > 100 * 1024) {
            throw new Error("Amazon Comprehend accepts at most 100 KiB of UTF-8 text");
        }

        const response = await this.client.send(
            new DetectPiiEntitiesCommand({
                Text: text,
                LanguageCode: this.languageCode,
            }),
            { abortSignal }
        );
        const characters = Array.from(text);
        const entities = selectEntities(response.Entities || [], characters.length, this.minScore);

        for (const entity of entities) {
            const begin = entity.BeginOffset as number;
            const end = entity.EndOffset as number;
            const original = characters.slice(begin, end);
            const replacement =
                this.replacement === "mask"
                    ? Array(original.length).fill(this.maskCharacter)
                    : Array.from(`[${entity.Type || "PII"}]`);
            characters.splice(begin, end - begin, ...replacement);
        }
        return characters.join("");
    }

    async redactChatOptions<T extends RedactableChatOptions>(
        options: T,
        abortSignal?: AbortSignal
    ): Promise<T> {
        return {
            ...options,
            ...(typeof options.prompt === "string"
                ? { prompt: await this.redact(options.prompt, abortSignal) }
                : {}),
            ...(options.messages
                ? {
                      messages: await Promise.all(
                          options.messages.map(async (message) => ({
                              ...message,
                              ...(typeof message.content === "string"
                                  ? { content: await this.redact(message.content, abortSignal) }
                                  : {}),
                          }))
                      ),
                  }
                : {}),
        };
    }

    redact$(text: string): Observable<string> {
        return new Observable((subscriber) => {
            const controller = new AbortController();
            this.redact(text, controller.signal).then(
                (value) => {
                    if (!subscriber.closed) {
                        subscriber.next(value);
                        subscriber.complete();
                    }
                },
                (error) => {
                    if (!subscriber.closed) subscriber.error(error);
                }
            );
            return () => controller.abort();
        });
    }

    redactOperator(): OperatorFunction<string, string> {
        return concatMap((text) => this.redact$(text));
    }

    endpointOperator<Options extends RedactableChatOptions, Result>(
        endpoint: ChatEndpoint<Options, Result>
    ): OperatorFunction<Options, Result> {
        return concatMap(async (options) => endpoint.chat(await this.redactChatOptions(options)));
    }
}

function selectEntities(entities: PiiEntity[], length: number, minScore: number): PiiEntity[] {
    const selected: PiiEntity[] = [];
    for (const entity of [...entities].sort((a, b) => (b.Score || 0) - (a.Score || 0))) {
        const begin = entity.BeginOffset;
        const end = entity.EndOffset;
        if (
            !Number.isInteger(begin) ||
            !Number.isInteger(end) ||
            (begin as number) < 0 ||
            (end as number) <= (begin as number) ||
            (end as number) > length ||
            (entity.Score || 0) < minScore ||
            selected.some(
                (other) =>
                    (begin as number) < (other.EndOffset as number) &&
                    (end as number) > (other.BeginOffset as number)
            )
        ) {
            continue;
        }
        selected.push(entity);
    }
    return selected.sort((a, b) => (b.BeginOffset as number) - (a.BeginOffset as number));
}
