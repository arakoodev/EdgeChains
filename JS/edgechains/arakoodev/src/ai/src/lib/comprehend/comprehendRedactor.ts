import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    DetectPiiEntitiesCommandInput,
    PiiEntity,
} from "@aws-sdk/client-comprehend";
import { from, isObservable, Observable, ObservableInput, of } from "rxjs";
import { mergeMap } from "rxjs/operators";

type ComprehendPiiClient = {
    send(
        command: DetectPiiEntitiesCommand,
    ): Promise<{ Entities?: PiiEntity[] }>;
};

interface ComprehendRedactorOptions {
    client?: ComprehendPiiClient;
    region?: string;
}

interface RedactPromptOptions {
    text: string;
    languageCode?: DetectPiiEntitiesCommandInput["LanguageCode"];
    replacement?: string;
    minScore?: number;
    entityTypes?: string[];
    includeEntityType?: boolean;
}

type RedactPromptStreamOptions = Omit<RedactPromptOptions, "text">;

export interface RedactedPiiEntity {
    type: string;
    score?: number;
    beginOffset: number;
    endOffset: number;
    text: string;
}

export interface RedactedPrompt {
    redactedText: string;
    entities: RedactedPiiEntity[];
}

export class ComprehendRedactor {
    private client: ComprehendPiiClient;

    constructor(options: ComprehendRedactorOptions = {}) {
        this.client =
            options.client ||
            new ComprehendClient({
                region: options.region || process.env.AWS_REGION || "us-east-1",
            });
    }

    async redactPrompt({
        text,
        languageCode = "en",
        replacement = "[REDACTED]",
        minScore = 0,
        entityTypes,
        includeEntityType = true,
    }: RedactPromptOptions): Promise<RedactedPrompt> {
        const response = await this.client.send(
            new DetectPiiEntitiesCommand({
                Text: text,
                LanguageCode: languageCode,
            }),
        );

        const allowedTypes = entityTypes ? new Set(entityTypes) : null;
        const entities = (response.Entities || [])
            .filter((entity) =>
                this.isUsableEntity(entity, minScore, allowedTypes),
            )
            .map((entity) => this.toRedactedEntity(text, entity))
            .sort((a, b) => a.beginOffset - b.beginOffset);

        return {
            redactedText: this.replaceEntities(
                text,
                entities,
                replacement,
                includeEntityType,
            ),
            entities,
        };
    }

    redactPrompt$(
        text: string | Promise<string> | ObservableInput<string>,
        options: RedactPromptStreamOptions = {},
    ): Observable<RedactedPrompt> {
        const source = isObservable(text)
            ? text
            : typeof text === "string"
              ? of(text)
              : from(text);

        return source.pipe(
            mergeMap((promptText) =>
                from(
                    this.redactPrompt({
                        ...options,
                        text: promptText,
                    }),
                ),
            ),
        );
    }

    private isUsableEntity(
        entity: PiiEntity,
        minScore: number,
        allowedTypes: Set<string> | null,
    ): boolean {
        if (
            entity.BeginOffset === undefined ||
            entity.EndOffset === undefined ||
            !entity.Type
        ) {
            return false;
        }
        if ((entity.Score || 0) < minScore) {
            return false;
        }
        return !allowedTypes || allowedTypes.has(entity.Type);
    }

    private toRedactedEntity(
        text: string,
        entity: PiiEntity,
    ): RedactedPiiEntity {
        const beginOffset = entity.BeginOffset || 0;
        const endOffset = entity.EndOffset || beginOffset;

        return {
            type: entity.Type || "UNKNOWN",
            score: entity.Score,
            beginOffset,
            endOffset,
            text: text.slice(beginOffset, endOffset),
        };
    }

    private replaceEntities(
        text: string,
        entities: RedactedPiiEntity[],
        replacement: string,
        includeEntityType: boolean,
    ): string {
        return entities
            .filter((entity, index, sorted) => {
                const previous = sorted[index - 1];
                return !previous || entity.beginOffset >= previous.endOffset;
            })
            .sort((a, b) => b.beginOffset - a.beginOffset)
            .reduce((redactedText, entity) => {
                const label = includeEntityType
                    ? `[${entity.type}]`
                    : replacement;
                return (
                    redactedText.slice(0, entity.beginOffset) +
                    label +
                    redactedText.slice(entity.endOffset)
                );
            }, text);
    }
}
