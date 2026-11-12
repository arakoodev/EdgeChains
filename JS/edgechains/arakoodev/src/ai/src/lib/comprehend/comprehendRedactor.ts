import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    PiiEntity,
    LanguageCode,
} from "@aws-sdk/client-comprehend";
import { Observable, from, switchMap, map } from "rxjs";

export interface ComprehendRedactorOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    languageCode?: LanguageCode | string;
    minConfidence?: number;
    maskMode?: "TAG" | "CHARACTER";
    maskCharacter?: string;
    entityTypes?: string[];
    client?: ComprehendClient;
}

export interface RedactionResult {
    originalText: string;
    redactedText: string;
    entitiesDetected: PiiEntity[];
}

export interface ChainableChatEndpoint {
    chat(options: { prompt?: string; [key: string]: any }): Promise<any>;
}

export class ComprehendRedactor {
    private client: ComprehendClient;
    private languageCode: LanguageCode;
    private minConfidence: number;
    private maskMode: "TAG" | "CHARACTER";
    private maskCharacter: string;
    private entityTypes?: Set<string>;

    constructor(options: ComprehendRedactorOptions = {}) {
        const region = options.region || process.env.AWS_REGION || "us-east-1";
        const accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        const secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";

        this.client =
            options.client ||
            new ComprehendClient({
                region,
                ...(accessKeyId && secretAccessKey
                    ? { credentials: { accessKeyId, secretAccessKey } }
                    : {}),
            });

        this.languageCode = (options.languageCode as LanguageCode) || "en";
        this.minConfidence = options.minConfidence ?? 0.5;
        this.maskMode = options.maskMode || "TAG";
        this.maskCharacter = options.maskCharacter || "*";
        if (options.entityTypes && options.entityTypes.length > 0) {
            this.entityTypes = new Set(options.entityTypes.map((t) => t.toUpperCase()));
        }
    }

    /**
     * Detects and redacts PII entities from a raw prompt string using AWS Comprehend.
     */
    async redactPrompt(text: string): Promise<RedactionResult> {
        if (!text || !text.trim()) {
            return { originalText: text, redactedText: text, entitiesDetected: [] };
        }

        const command = new DetectPiiEntitiesCommand({
            Text: text,
            LanguageCode: this.languageCode,
        });

        const response = await this.client.send(command);
        const rawEntities = response.Entities || [];

        const filteredEntities = rawEntities.filter((entity) => {
            const score = entity.Score ?? 0;
            if (score < this.minConfidence) return false;
            if (this.entityTypes && entity.Type && !this.entityTypes.has(entity.Type.toUpperCase())) {
                return false;
            }
            return (
                typeof entity.BeginOffset === "number" &&
                typeof entity.EndOffset === "number" &&
                entity.EndOffset > entity.BeginOffset
            );
        });

        // Sort descending by BeginOffset so string replacements do not shift earlier offsets
        const sortedDesc = [...filteredEntities].sort(
            (a, b) => (b.BeginOffset ?? 0) - (a.BeginOffset ?? 0)
        );

        let redacted = text;
        for (const entity of sortedDesc) {
            const start = entity.BeginOffset!;
            const end = entity.EndOffset!;
            const label = entity.Type || "PII";
            const replacement =
                this.maskMode === "TAG"
                    ? `[REDACTED_${label}]`
                    : this.maskCharacter.repeat(Math.max(1, end - start));

            redacted = redacted.slice(0, start) + replacement + redacted.slice(end);
        }

        return {
            originalText: text,
            redactedText: redacted,
            entitiesDetected: filteredEntities,
        };
    }

    /**
     * Wraps PII redaction as an RxJS Observable so it can be composed in reactive pipelines.
     */
    redactObservable(prompt: string): Observable<RedactionResult> {
        return from(this.redactPrompt(prompt));
    }

    /**
     * Chains PII redaction directly with any EdgeChains AI Endpoint (e.g., OpenAI, GeminiAI, LlamaAI)
     * as an RxJS Observable pipeline: Prompt -> AWS Comprehend Redaction -> LLM Endpoint.
     */
    chainWithEndpoint<T = any>(
        endpoint: ChainableChatEndpoint,
        chatOptions: { prompt: string; [key: string]: any }
    ): Observable<{ redaction: RedactionResult; llmResponse: T }> {
        return this.redactObservable(chatOptions.prompt).pipe(
            switchMap((redaction) =>
                from(
                    endpoint.chat({
                        ...chatOptions,
                        prompt: redaction.redactedText,
                    })
                ).pipe(
                    map((llmResponse: T) => ({
                        redaction,
                        llmResponse,
                    }))
                )
            )
        );
    }
}
