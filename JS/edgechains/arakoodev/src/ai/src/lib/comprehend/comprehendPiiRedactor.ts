import { Observable, OperatorFunction, concatMap, from } from "rxjs";

export const AWS_COMPREHEND_MAX_UTF8_BYTES = 100_000;
export const DEFAULT_SAFE_CHUNK_BYTES = 95_000;

export type RedactionMaskMode = "ENTITY_TYPE" | "MASK_CHAR" | "FIXED_MASK";

export interface PiiEntity {
    Type?: string;
    Score?: number;
    BeginOffset?: number;
    EndOffset?: number;
}

export interface PiiLabel {
    Name?: string;
    Score?: number;
}

export interface DetectPiiEntitiesResponse {
    Entities?: PiiEntity[];
}

export interface ContainsPiiEntitiesResponse {
    Labels?: PiiLabel[];
}

export interface ComprehendClientLike {
    detectPiiEntities?: (params: {
        Text: string;
        LanguageCode: string;
    }) => Promise<DetectPiiEntitiesResponse>;
    containsPiiEntities?: (params: {
        Text: string;
        LanguageCode: string;
    }) => Promise<ContainsPiiEntitiesResponse>;
    send?: (command: any, options?: { abortSignal?: AbortSignal }) => Promise<any>;
}

export interface ComprehendPiiRedactorOptions {
    client?: ComprehendClientLike;
    region?: string;
    languageCode?: string;
    confidenceThreshold?: number;
    entityTypes?: string[];
    maskMode?: RedactionMaskMode;
    maskChar?: string;
    fixedMask?: string;
    maxChunkBytes?: number;
}

export interface RedactableChatOptions {
    prompt?: string;
    messages?: Array<{ role: string; content: string; [key: string]: any }>;
    [key: string]: any;
}

export interface ChatEndpoint<
    Options extends RedactableChatOptions = RedactableChatOptions,
    Result = any,
> {
    chat(options: Options): Promise<Result>;
}

export function splitTextUtf8Chunks(
    text: string,
    maxBytes: number = DEFAULT_SAFE_CHUNK_BYTES
): Array<{ charOffset: number; chunkText: string }> {
    if (maxBytes <= 0 || maxBytes > AWS_COMPREHEND_MAX_UTF8_BYTES) {
        throw new Error(`maxBytes must be between 1 and ${AWS_COMPREHEND_MAX_UTF8_BYTES}`);
    }
    const codePoints = Array.from(text);
    if (codePoints.length === 0) {
        return [{ charOffset: 0, chunkText: "" }];
    }
    if (Buffer.byteLength(text, "utf8") <= maxBytes) {
        return [{ charOffset: 0, chunkText: text }];
    }

    const chunks: Array<{ charOffset: number; chunkText: string }> = [];
    let idx = 0;

    while (idx < codePoints.length) {
        let low = idx + 1;
        let high = Math.min(codePoints.length, idx + maxBytes);
        let bestEnd = low;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const sliceStr = codePoints.slice(idx, mid).join("");
            if (Buffer.byteLength(sliceStr, "utf8") <= maxBytes) {
                bestEnd = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        if (bestEnd < codePoints.length) {
            const windowPoints = codePoints.slice(idx, bestEnd);
            let splitRel = -1;
            for (let i = windowPoints.length - 1; i >= Math.floor(windowPoints.length / 2); i--) {
                if (windowPoints[i] === "\n" || windowPoints[i] === " ") {
                    splitRel = i;
                    break;
                }
            }
            if (splitRel !== -1) {
                bestEnd = idx + splitRel + 1;
            }
        }

        chunks.push({
            charOffset: idx,
            chunkText: codePoints.slice(idx, bestEnd).join(""),
        });
        idx = bestEnd;
    }

    return chunks;
}

export class ComprehendPiiRedactor {
    private readonly client: ComprehendClientLike;
    private readonly languageCode: string;
    private readonly confidenceThreshold: number;
    private readonly entityTypes?: Set<string>;
    private readonly maskMode: RedactionMaskMode;
    private readonly maskChar: string;
    private readonly fixedMask: string;
    private readonly maxChunkBytes: number;

    constructor(options: ComprehendPiiRedactorOptions = {}) {
        if (!options.client) {
            throw new Error("A Comprehend client instance must be provided in options.client");
        }
        this.client = options.client;
        this.languageCode = options.languageCode ?? "en";
        this.confidenceThreshold = options.confidenceThreshold ?? 0.5;
        this.entityTypes = options.entityTypes
            ? new Set(options.entityTypes.map((t) => t.toUpperCase()))
            : undefined;
        this.maskMode = options.maskMode ?? "ENTITY_TYPE";
        this.maskChar = (options.maskChar || "*")[0];
        this.fixedMask = options.fixedMask ?? "[REDACTED]";
        this.maxChunkBytes = options.maxChunkBytes ?? DEFAULT_SAFE_CHUNK_BYTES;
    }

    private async invokeDetectChunk(
        chunkText: string,
        signal?: AbortSignal
    ): Promise<DetectPiiEntitiesResponse> {
        if (this.client.detectPiiEntities) {
            return this.client.detectPiiEntities({
                Text: chunkText,
                LanguageCode: this.languageCode,
            });
        }
        if (this.client.send) {
            return this.client.send(
                { input: { Text: chunkText, LanguageCode: this.languageCode } },
                signal ? { abortSignal: signal } : undefined
            );
        }
        throw new Error("Client must implement detectPiiEntities or send()");
    }

    async detectPiiEntities(text: string, signal?: AbortSignal): Promise<Required<PiiEntity>[]> {
        if (!text) return [];
        const codePoints = Array.from(text);
        const chunks = splitTextUtf8Chunks(text, this.maxChunkBytes);
        const rawEntities: Required<PiiEntity>[] = [];

        for (const { charOffset, chunkText } of chunks) {
            if (!chunkText) continue;
            const chunkPointsLen = Array.from(chunkText).length;
            const res = await this.invokeDetectChunk(chunkText, signal);
            for (const entity of res?.Entities ?? []) {
                const begin = entity.BeginOffset ?? -1;
                const end = entity.EndOffset ?? -1;
                const score = entity.Score ?? 0;
                const type = (entity.Type ?? "UNKNOWN").toUpperCase();

                if (
                    Number.isInteger(begin) &&
                    Number.isInteger(end) &&
                    begin >= 0 &&
                    end > begin &&
                    end <= chunkPointsLen &&
                    score >= this.confidenceThreshold &&
                    (!this.entityTypes || this.entityTypes.has(type))
                ) {
                    rawEntities.push({
                        Type: type,
                        Score: score,
                        BeginOffset: charOffset + begin,
                        EndOffset: charOffset + end,
                    });
                }
            }
        }

        const sortedByScore = [...rawEntities].sort(
            (a, b) =>
                b.Score - a.Score ||
                b.EndOffset - b.BeginOffset - (a.EndOffset - a.BeginOffset) ||
                a.BeginOffset - b.BeginOffset
        );

        const selected: Required<PiiEntity>[] = [];
        for (const candidate of sortedByScore) {
            if (
                candidate.EndOffset <= codePoints.length &&
                !selected.some(
                    (existing) =>
                        candidate.BeginOffset < existing.EndOffset &&
                        candidate.EndOffset > existing.BeginOffset
                )
            ) {
                selected.push(candidate);
            }
        }

        return selected.sort((a, b) => a.BeginOffset - b.BeginOffset);
    }

    async containsPiiEntities(text: string, signal?: AbortSignal): Promise<Required<PiiLabel>[]> {
        if (!text) return [];
        const chunks = splitTextUtf8Chunks(text, this.maxChunkBytes);
        const scoresByType = new Map<string, number>();

        for (const { chunkText } of chunks) {
            if (!chunkText) continue;
            let res: ContainsPiiEntitiesResponse;
            if (this.client.containsPiiEntities) {
                res = await this.client.containsPiiEntities({
                    Text: chunkText,
                    LanguageCode: this.languageCode,
                });
            } else if (this.client.send) {
                res = await this.client.send(
                    { input: { Text: chunkText, LanguageCode: this.languageCode } },
                    signal ? { abortSignal: signal } : undefined
                );
            } else {
                throw new Error("Client must implement containsPiiEntities or send()");
            }

            for (const label of res?.Labels ?? []) {
                const name = (label.Name ?? "UNKNOWN").toUpperCase();
                const score = label.Score ?? 0;
                if (
                    score >= this.confidenceThreshold &&
                    (!this.entityTypes || this.entityTypes.has(name))
                ) {
                    const prev = scoresByType.get(name) ?? -1;
                    if (score > prev) {
                        scoresByType.set(name, score);
                    }
                }
            }
        }

        return Array.from(scoresByType.entries())
            .map(([Name, Score]) => ({ Name, Score }))
            .sort((a, b) => b.Score - a.Score);
    }

    private formatReplacement(entity: Required<PiiEntity>): string {
        if (this.maskMode === "MASK_CHAR") {
            return this.maskChar.repeat(Math.max(1, entity.EndOffset - entity.BeginOffset));
        }
        if (this.maskMode === "FIXED_MASK") {
            return this.fixedMask;
        }
        return `[${entity.Type}]`;
    }

    async redact(text: string, signal?: AbortSignal): Promise<string> {
        if (!text) return text;
        const entities = await this.detectPiiEntities(text, signal);
        if (entities.length === 0) return text;

        const codePoints = Array.from(text);
        for (let i = entities.length - 1; i >= 0; i--) {
            const entity = entities[i];
            const replacement = this.formatReplacement(entity);
            codePoints.splice(
                entity.BeginOffset,
                entity.EndOffset - entity.BeginOffset,
                replacement
            );
        }
        return codePoints.join("");
    }

    async batchRedact(texts: string[], signal?: AbortSignal): Promise<string[]> {
        const outputs: string[] = [];
        for (const text of texts) {
            outputs.push(await this.redact(text, signal));
        }
        return outputs;
    }

    async redactChatOptions<Options extends RedactableChatOptions>(
        options: Options,
        signal?: AbortSignal
    ): Promise<Options> {
        const cloned: Options = { ...options };
        if (typeof cloned.prompt === "string") {
            cloned.prompt = await this.redact(cloned.prompt, signal);
        }
        if (Array.isArray(cloned.messages)) {
            cloned.messages = await Promise.all(
                cloned.messages.map(async (m) => ({
                    ...m,
                    content:
                        typeof m.content === "string"
                            ? await this.redact(m.content, signal)
                            : m.content,
                }))
            );
        }
        return cloned;
    }

    redact$(text: string): Observable<string> {
        return new Observable<string>((subscriber) => {
            const controller = new AbortController();
            this.redact(text, controller.signal).then(
                (redacted) => {
                    if (!subscriber.closed) {
                        subscriber.next(redacted);
                        subscriber.complete();
                    }
                },
                (err) => {
                    if (!subscriber.closed) {
                        subscriber.error(err);
                    }
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
        return concatMap((options) =>
            from(
                this.redactChatOptions(options).then((redactedOpts) => endpoint.chat(redactedOpts))
            )
        );
    }
}
