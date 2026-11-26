import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    DetectPiiEntitiesCommandOutput,
    LanguageCode,
    PiiEntity,
    PiiEntityType,
} from "@aws-sdk/client-comprehend";
import { Observable, OperatorFunction, from, map, mergeMap } from "rxjs";

export interface ComprehendCommandClient {
    send(command: DetectPiiEntitiesCommand): Promise<DetectPiiEntitiesCommandOutput>;
}

export interface RedactionConfig {
    region?: string;
    languageCode?: LanguageCode;
    minScore?: number;
    entityTypes?: ReadonlyArray<PiiEntityType>;
    maskFormat?: (entityType: string) => string;
    client?: ComprehendCommandClient;
}

export interface RedactionResult {
    originalText: string;
    redactedText: string;
    entities: PiiEntity[];
}

interface OffsetSpan {
    begin: number;
    end: number;
    type: string;
}

export class AwsComprehendRedactor {
    private readonly client: ComprehendCommandClient;
    private readonly languageCode: LanguageCode;
    private readonly minScore: number;
    private readonly entityTypes?: ReadonlySet<string>;
    private readonly maskFormat: (entityType: string) => string;

    constructor(config: RedactionConfig = {}) {
        const minScore = config.minScore ?? 0.5;
        if (minScore < 0 || minScore > 1 || Number.isNaN(minScore)) {
            throw new RangeError("minScore must be a number between 0 and 1");
        }
        this.client =
            config.client ??
            new ComprehendClient({
                region: config.region ?? process.env.AWS_REGION ?? "us-east-1",
            });
        this.languageCode = config.languageCode ?? LanguageCode.EN;
        this.minScore = minScore;
        this.entityTypes = config.entityTypes ? new Set(config.entityTypes) : undefined;
        this.maskFormat = config.maskFormat ?? ((entityType: string) => `[REDACTED_${entityType}]`);
    }

    async redactText(text: string): Promise<RedactionResult> {
        if (!text || text.trim().length === 0) {
            return { originalText: text, redactedText: text, entities: [] };
        }

        const command = new DetectPiiEntitiesCommand({
            Text: text,
            LanguageCode: this.languageCode,
        });

        const response = await this.client.send(command);
        const detected = (response.Entities ?? []).filter((entity): entity is PiiEntity => {
            const score = entity.Score ?? 0;
            const typeMatches =
                !this.entityTypes ||
                (entity.Type !== undefined && this.entityTypes.has(entity.Type));
            const hasValidOffsets =
                entity.BeginOffset !== undefined &&
                entity.EndOffset !== undefined &&
                entity.BeginOffset >= 0 &&
                entity.EndOffset > entity.BeginOffset &&
                entity.EndOffset <= text.length;
            return score >= this.minScore && typeMatches && hasValidOffsets;
        });

        const spans = this.resolveNonOverlappingSpans(detected);
        let redacted = text;
        for (let i = spans.length - 1; i >= 0; i--) {
            const span = spans[i];
            redacted =
                redacted.slice(0, span.begin) +
                this.maskFormat(span.type) +
                redacted.slice(span.end);
        }

        return {
            originalText: text,
            redactedText: redacted,
            entities: detected,
        };
    }

    asOperator(): OperatorFunction<string, string> {
        return (source$: Observable<string>) =>
            source$.pipe(
                mergeMap((prompt: string) =>
                    from(this.redactText(prompt)).pipe(map((result) => result.redactedText))
                )
            );
    }

    chainWithEndpoint<TResponse>(
        prompt$: Observable<string>,
        invokeEndpoint: (redactedPrompt: string) => Observable<TResponse> | Promise<TResponse>
    ): Observable<TResponse> {
        return prompt$.pipe(
            this.asOperator(),
            mergeMap((redactedPrompt: string) => from(invokeEndpoint(redactedPrompt)))
        );
    }

    private resolveNonOverlappingSpans(entities: ReadonlyArray<PiiEntity>): OffsetSpan[] {
        const sorted = [...entities].sort((a, b) => {
            const beginDiff = (a.BeginOffset ?? 0) - (b.BeginOffset ?? 0);
            if (beginDiff !== 0) {
                return beginDiff;
            }
            return (b.EndOffset ?? 0) - (a.EndOffset ?? 0);
        });

        const merged: OffsetSpan[] = [];
        for (const entity of sorted) {
            const begin = entity.BeginOffset ?? 0;
            const end = entity.EndOffset ?? 0;
            const type = entity.Type ?? "PII";
            const prev = merged[merged.length - 1];
            if (!prev || begin >= prev.end) {
                merged.push({ begin, end, type });
            } else if (end > prev.end) {
                prev.end = end;
            }
        }
        return merged;
    }
}
