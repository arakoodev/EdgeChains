import { ComprehendClient, DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";
import { Observable, from } from "rxjs";
import { mergeMap } from "rxjs/operators";
import type {
    AWSComprehendRedactorConfig,
    RedactionOptions,
    RedactionResult,
    PiiEntity,
    PiiEntityType,
    LanguageCode,
    ChatMessage,
    EndpointLike,
    EndpointChatOptions,
    RedactionMaskMode,
    RedactorInterface,
    ComprehendClientLike,
} from "./types.js";

interface InternalResolvedEntity {
    entity: PiiEntity;
    beginChar: number;
    endChar: number;
    score: number;
}

interface TextChunk {
    text: string;
    charOffset: number;
    byteOffset: number;
}

const AWS_COMPREHEND_MAX_BYTES = 80000;

function utf8ByteOffsetToCharIndex(utf8Buffer: Buffer, byteOffset: number): number {
    if (byteOffset <= 0) return 0;
    if (byteOffset >= utf8Buffer.length) {
        return utf8Buffer.toString("utf-8").length;
    }
    return utf8Buffer.subarray(0, byteOffset).toString("utf-8").length;
}

export function chunkTextByBytes(
    text: string,
    maxBytes: number = AWS_COMPREHEND_MAX_BYTES
): TextChunk[] {
    const totalBytes = Buffer.byteLength(text, "utf-8");
    if (totalBytes <= maxBytes) {
        return [{ text, charOffset: 0, byteOffset: 0 }];
    }

    const chunks: TextChunk[] = [];
    let currentStartChar = 0;
    let currentByteOffset = 0;

    while (currentStartChar < text.length) {
        let endChar = Math.min(text.length, currentStartChar + maxBytes);
        let segment = text.slice(currentStartChar, endChar);

        while (Buffer.byteLength(segment, "utf-8") > maxBytes && endChar > currentStartChar + 1) {
            endChar = Math.floor((currentStartChar + endChar) / 2);
            segment = text.slice(currentStartChar, endChar);
        }

        if (endChar < text.length) {
            const lastDoubleNewline = segment.lastIndexOf("\n\n");
            const lastNewline = segment.lastIndexOf("\n");
            const lastPeriod = segment.lastIndexOf(". ");
            const lastSpace = segment.lastIndexOf(" ");

            let splitIndex = -1;
            if (lastDoubleNewline > segment.length * 0.5) {
                splitIndex = lastDoubleNewline + 2;
            } else if (lastNewline > segment.length * 0.5) {
                splitIndex = lastNewline + 1;
            } else if (lastPeriod > segment.length * 0.5) {
                splitIndex = lastPeriod + 2;
            } else if (lastSpace > segment.length * 0.5) {
                splitIndex = lastSpace + 1;
            }

            if (splitIndex > 0) {
                endChar = currentStartChar + splitIndex;
                segment = text.slice(currentStartChar, endChar);
            }
        }

        const chunkBytes = Buffer.byteLength(segment, "utf-8");
        chunks.push({
            text: segment,
            charOffset: currentStartChar,
            byteOffset: currentByteOffset,
        });

        currentByteOffset += chunkBytes;
        currentStartChar = endChar;
    }

    return chunks;
}

export class AWSComprehendRedactor implements RedactorInterface {
    private client: ComprehendClient | ComprehendClientLike;
    private defaultLanguageCode: LanguageCode | string;
    private defaultMaskMode: RedactionMaskMode;
    private defaultMaskCharacter: string;
    private defaultScoreThreshold: number;
    private defaultEntityTypes?: Set<string>;
    private defaultCustomPlaceholder?:
        string | ((entity: PiiEntity, originalSubstring: string) => string);
    private defaultChunkSizeBytes: number;

    constructor(config: AWSComprehendRedactorConfig = {}) {
        this.defaultLanguageCode = config.defaultLanguageCode || "en";
        this.defaultMaskMode = config.defaultMaskMode || "REPLACE_WITH_PII_ENTITY_TYPE";
        this.defaultMaskCharacter = config.defaultMaskCharacter || "*";
        this.defaultScoreThreshold =
            typeof config.defaultScoreThreshold === "number" ? config.defaultScoreThreshold : 0.5;
        this.defaultChunkSizeBytes = config.chunkSizeBytes || AWS_COMPREHEND_MAX_BYTES;

        if (config.defaultEntityTypes && config.defaultEntityTypes.length > 0) {
            this.defaultEntityTypes = new Set(config.defaultEntityTypes);
        }

        this.defaultCustomPlaceholder = config.customPlaceholder;

        if (config.client) {
            this.client = config.client;
        } else {
            const clientConfig: Record<string, unknown> = {};
            if (config.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION) {
                clientConfig.region =
                    config.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;
            } else {
                clientConfig.region = "us-east-1";
            }

            if (config.credentials) {
                clientConfig.credentials = config.credentials;
            } else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
                clientConfig.credentials = {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                    sessionToken: process.env.AWS_SESSION_TOKEN,
                };
            }

            this.client = new ComprehendClient(clientConfig);
        }
    }

    getClient(): ComprehendClient | ComprehendClientLike {
        return this.client;
    }

    async detectPii(
        text: string,
        languageCode?: LanguageCode | string,
        chunkSizeBytes?: number
    ): Promise<PiiEntity[]> {
        if (!text || text.trim().length === 0) {
            return [];
        }

        const lang = (languageCode || this.defaultLanguageCode) as string;
        const maxBytes = chunkSizeBytes || this.defaultChunkSizeBytes;
        const chunks = chunkTextByBytes(text, maxBytes);
        const allEntities: PiiEntity[] = [];

        for (const chunk of chunks) {
            const chunkEntities = await this.callDetectPii(chunk.text, lang);
            for (const ent of chunkEntities) {
                allEntities.push({
                    ...ent,
                    BeginOffset:
                        typeof ent.BeginOffset === "number"
                            ? ent.BeginOffset + chunk.byteOffset
                            : ent.BeginOffset,
                    EndOffset:
                        typeof ent.EndOffset === "number"
                            ? ent.EndOffset + chunk.byteOffset
                            : ent.EndOffset,
                });
            }
        }

        return allEntities;
    }

    private async callDetectPii(text: string, languageCode: string): Promise<PiiEntity[]> {
        try {
            if (
                "detectPiiEntities" in this.client &&
                typeof this.client.detectPiiEntities === "function"
            ) {
                const response = await this.client.detectPiiEntities({
                    Text: text,
                    LanguageCode: languageCode,
                });
                return response.Entities || [];
            }

            if ("send" in this.client && typeof this.client.send === "function") {
                const command = new DetectPiiEntitiesCommand({
                    Text: text,
                    LanguageCode: languageCode as LanguageCode,
                });
                const response = await this.client.send(command);
                if (response && typeof response === "object" && "Entities" in response) {
                    const entities = response.Entities;
                    if (Array.isArray(entities)) {
                        return entities;
                    }
                }
                return [];
            }

            throw new Error("Client does not provide detectPiiEntities or send method.");
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`AWS Comprehend DetectPiiEntities failed: ${message}`);
        }
    }

    private resolveNonOverlappingEntities(
        text: string,
        entities: PiiEntity[],
        options?: RedactionOptions
    ): InternalResolvedEntity[] {
        if (!entities || entities.length === 0) {
            return [];
        }

        const scoreThreshold =
            typeof options?.scoreThreshold === "number"
                ? options.scoreThreshold
                : this.defaultScoreThreshold;

        const allowedTypes = options?.entityTypes
            ? new Set(options.entityTypes)
            : this.defaultEntityTypes;

        const utf8Buffer = Buffer.from(text, "utf-8");
        const resolved: InternalResolvedEntity[] = [];

        for (const entity of entities) {
            const score = entity.Score ?? 0;
            if (score < scoreThreshold) {
                continue;
            }

            if (allowedTypes && entity.Type && !allowedTypes.has(entity.Type)) {
                continue;
            }

            if (typeof entity.BeginOffset !== "number" || typeof entity.EndOffset !== "number") {
                continue;
            }

            const beginChar = utf8ByteOffsetToCharIndex(utf8Buffer, entity.BeginOffset);
            const endChar = utf8ByteOffsetToCharIndex(utf8Buffer, entity.EndOffset);

            if (beginChar < 0 || endChar > text.length || beginChar >= endChar) {
                continue;
            }

            resolved.push({
                entity,
                beginChar,
                endChar,
                score,
            });
        }

        resolved.sort((a, b) => {
            if (a.beginChar !== b.beginChar) {
                return a.beginChar - b.beginChar;
            }
            const lenA = a.endChar - a.beginChar;
            const lenB = b.endChar - b.beginChar;
            if (lenA !== lenB) {
                return lenB - lenA;
            }
            return b.score - a.score;
        });

        const nonOverlapping: InternalResolvedEntity[] = [];
        let lastEndChar = -1;

        for (const item of resolved) {
            if (item.beginChar >= lastEndChar) {
                nonOverlapping.push(item);
                lastEndChar = item.endChar;
            }
        }

        return nonOverlapping;
    }

    private getReplacementString(
        item: InternalResolvedEntity,
        originalSubstring: string,
        options?: RedactionOptions
    ): string {
        const maskMode = options?.maskMode || this.defaultMaskMode;
        const maskChar = options?.maskCharacter || this.defaultMaskCharacter;
        const customPlaceholder =
            options?.customPlaceholder !== undefined
                ? options.customPlaceholder
                : this.defaultCustomPlaceholder;

        switch (maskMode) {
            case "REPLACE_WITH_PII_ENTITY_TYPE": {
                const entityType = item.entity.Type || "PII";
                return `[${entityType}]`;
            }
            case "MASK": {
                const length = item.endChar - item.beginChar;
                return maskChar.repeat(Math.max(1, length));
            }
            case "CUSTOM": {
                if (typeof customPlaceholder === "function") {
                    return customPlaceholder(item.entity, originalSubstring);
                }
                if (typeof customPlaceholder === "string") {
                    return customPlaceholder;
                }
                return "[REDACTED]";
            }
            default:
                return `[${item.entity.Type || "PII"}]`;
        }
    }

    async redactDetailed(text: string, options?: RedactionOptions): Promise<RedactionResult> {
        if (!text || text.trim().length === 0) {
            return {
                redactedText: text,
                originalText: text,
                entities: [],
                redactedEntityCount: 0,
            };
        }

        const rawEntities = await this.detectPii(
            text,
            options?.languageCode,
            options?.chunkSizeBytes
        );
        const resolved = this.resolveNonOverlappingEntities(text, rawEntities, options);

        if (resolved.length === 0) {
            return {
                redactedText: text,
                originalText: text,
                entities: [],
                redactedEntityCount: 0,
            };
        }

        resolved.sort((a, b) => b.beginChar - a.beginChar);

        let redacted = text;
        const redactedEntities: PiiEntity[] = [];

        for (const item of resolved) {
            const originalSub = text.slice(item.beginChar, item.endChar);
            const replacement = this.getReplacementString(item, originalSub, options);
            redacted =
                redacted.slice(0, item.beginChar) + replacement + redacted.slice(item.endChar);
            redactedEntities.unshift(item.entity);
        }

        return {
            redactedText: redacted,
            originalText: text,
            entities: redactedEntities,
            redactedEntityCount: redactedEntities.length,
        };
    }

    async redact(text: string, options?: RedactionOptions): Promise<string> {
        const result = await this.redactDetailed(text, options);
        return result.redactedText;
    }

    async redactMessages(
        messages: ChatMessage[],
        options?: RedactionOptions
    ): Promise<ChatMessage[]> {
        if (!Array.isArray(messages) || messages.length === 0) {
            return [];
        }

        const redactedList: ChatMessage[] = [];
        for (const msg of messages) {
            if (typeof msg.content === "string") {
                const redactedContent = await this.redact(msg.content, options);
                redactedList.push({
                    ...msg,
                    content: redactedContent,
                });
            } else {
                redactedList.push({ ...msg });
            }
        }
        return redactedList;
    }

    redactObservable(
        input: string | Observable<string>,
        options?: RedactionOptions
    ): Observable<string> {
        if (typeof input === "string") {
            return new Observable<string>((subscriber) => {
                this.redact(input, options)
                    .then((result) => {
                        subscriber.next(result);
                        subscriber.complete();
                    })
                    .catch((err) => {
                        subscriber.error(err);
                    });
            });
        }

        return input.pipe(mergeMap((text) => from(this.redact(text, options))));
    }

    operator(options?: RedactionOptions): (source$: Observable<string>) => Observable<string> {
        return (source$: Observable<string>) =>
            source$.pipe(mergeMap((text) => from(this.redact(text, options))));
    }

    async chain<T = unknown>(
        endpoint: EndpointLike,
        chatOptions: EndpointChatOptions,
        options?: RedactionOptions
    ): Promise<T> {
        if (!endpoint) {
            throw new Error("AWSComprehendRedactor.chain requires an endpoint instance.");
        }

        const sanitizedOptions: EndpointChatOptions = { ...chatOptions };

        if (typeof sanitizedOptions.prompt === "string") {
            sanitizedOptions.prompt = await this.redact(sanitizedOptions.prompt, options);
        }

        if (typeof sanitizedOptions.content === "string") {
            sanitizedOptions.content = await this.redact(sanitizedOptions.content, options);
        }

        if (Array.isArray(sanitizedOptions.messages)) {
            sanitizedOptions.messages = await this.redactMessages(
                sanitizedOptions.messages,
                options
            );
        }

        if (typeof endpoint.chat === "function") {
            return (await endpoint.chat(sanitizedOptions)) as T;
        }

        if (typeof endpoint.makeRequest === "function") {
            return (await endpoint.makeRequest(sanitizedOptions)) as T;
        }

        if (typeof endpoint.streamedChat === "function") {
            return (await endpoint.streamedChat(sanitizedOptions)) as T;
        }

        throw new Error("Endpoint class does not implement .chat() or .makeRequest() method.");
    }

    chainObservable<T = unknown>(
        endpoint: EndpointLike,
        chatOptions: EndpointChatOptions,
        options?: RedactionOptions
    ): Observable<T> {
        return new Observable<T>((subscriber) => {
            this.chain<T>(endpoint, chatOptions, options)
                .then((result) => {
                    subscriber.next(result);
                    subscriber.complete();
                })
                .catch((err) => {
                    subscriber.error(err);
                });
        });
    }

    wrap<T extends EndpointLike>(endpoint: T, defaultOptions?: RedactionOptions): T {
        const redactor = this;

        return new Proxy(endpoint, {
            get(target, prop, receiver) {
                const original = Reflect.get(target, prop, receiver);

                if (prop === "chat" && typeof original === "function") {
                    return async function (chatOptions: EndpointChatOptions) {
                        return redactor.chain(target, chatOptions, defaultOptions);
                    };
                }

                if (prop === "makeRequest" && typeof original === "function") {
                    return async function (chatOptions: EndpointChatOptions) {
                        return redactor.chain(target, chatOptions, defaultOptions);
                    };
                }

                if (prop === "streamedChat" && typeof original === "function") {
                    return async function (chatOptions: EndpointChatOptions) {
                        const sanitized: EndpointChatOptions = { ...chatOptions };
                        if (typeof sanitized.prompt === "string") {
                            sanitized.prompt = await redactor.redact(
                                sanitized.prompt,
                                defaultOptions
                            );
                        }
                        if (typeof sanitized.content === "string") {
                            sanitized.content = await redactor.redact(
                                sanitized.content,
                                defaultOptions
                            );
                        }
                        if (Array.isArray(sanitized.messages)) {
                            sanitized.messages = await redactor.redactMessages(
                                sanitized.messages,
                                defaultOptions
                            );
                        }
                        return target.streamedChat!(sanitized);
                    };
                }

                return typeof original === "function" ? original.bind(target) : original;
            },
        });
    }
}

export { AWSComprehendRedactor as ComprehendRedactor };
export { AWSComprehendRedactor as AwsComprehendRedactor };
