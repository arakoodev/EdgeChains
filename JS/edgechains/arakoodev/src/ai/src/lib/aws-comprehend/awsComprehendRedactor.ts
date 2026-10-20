import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    type ComprehendClientConfig,
    type LanguageCode,
    type PiiEntity,
    type PiiEntityType,
} from "@aws-sdk/client-comprehend";
import { from, isObservable, mergeMap, Observable, of } from "rxjs";

type RedactionMode = "replace" | "mask";

export interface AwsComprehendRedactorOptions {
    client?: Pick<ComprehendClient, "send">;
    clientConfig?: ComprehendClientConfig;
    languageCode?: LanguageCode;
    minScore?: number;
    replacementText?: string;
    redactionMode?: RedactionMode;
    entityTypes?: PiiEntityType[];
    maskCharacter?: string;
}

export interface RedactablePrompt {
    prompt: string;
}

export interface RedactedPiiEntity {
    type: PiiEntityType;
    score: number;
    beginOffset: number;
    endOffset: number;
    text: string;
}

export interface RedactedPromptResult {
    prompt: string;
    redactedPrompt: string;
    entities: RedactedPiiEntity[];
}

type RedactableInput = string | RedactablePrompt;

export class AwsComprehendRedactor {
    private readonly client: Pick<ComprehendClient, "send">;
    private readonly languageCode: LanguageCode;
    private readonly minScore: number;
    private readonly replacementText?: string;
    private readonly redactionMode: RedactionMode;
    private readonly entityTypes?: Set<PiiEntityType>;
    private readonly maskCharacter: string;

    constructor(options: AwsComprehendRedactorOptions = {}) {
        this.client = options.client ?? new ComprehendClient(options.clientConfig ?? {});
        this.languageCode = options.languageCode ?? "en";
        this.minScore = options.minScore ?? 0;
        this.replacementText = options.replacementText;
        this.redactionMode = options.redactionMode ?? "replace";
        this.entityTypes = options.entityTypes ? new Set(options.entityTypes) : undefined;
        this.maskCharacter = options.maskCharacter ?? "*";
    }

    async redact(input: RedactableInput): Promise<RedactedPromptResult> {
        const prompt = typeof input === "string" ? input : input.prompt;
        const response = await this.client.send(
            new DetectPiiEntitiesCommand({
                Text: prompt,
                LanguageCode: this.languageCode,
            })
        );
        const entities = this.normalizeEntities(prompt, response.Entities ?? []);
        const redactedPrompt = this.applyRedactions(prompt, entities);

        return {
            prompt,
            redactedPrompt,
            entities,
        };
    }

    redactObservable(input: Observable<RedactableInput> | RedactableInput): Observable<RedactedPromptResult> {
        const source = isObservable(input) ? input : of(input);
        return source.pipe(mergeMap((prompt) => from(this.redact(prompt))));
    }

    private normalizeEntities(prompt: string, entities: PiiEntity[]): RedactedPiiEntity[] {
        return entities
            .filter((entity): entity is Required<Pick<PiiEntity, "Type" | "Score" | "BeginOffset" | "EndOffset">> => {
                if (!entity.Type || entity.Score === undefined) return false;
                if (entity.BeginOffset === undefined || entity.EndOffset === undefined) return false;
                if (entity.Score < this.minScore) return false;
                if (this.entityTypes && !this.entityTypes.has(entity.Type)) return false;
                return entity.BeginOffset >= 0 && entity.EndOffset <= prompt.length;
            })
            .sort((a, b) => a.BeginOffset - b.BeginOffset)
            .filter((entity, index, sorted) => {
                const previous = sorted[index - 1];
                return !previous || entity.BeginOffset >= previous.EndOffset;
            })
            .map((entity) => ({
                type: entity.Type,
                score: entity.Score,
                beginOffset: entity.BeginOffset,
                endOffset: entity.EndOffset,
                text: prompt.slice(entity.BeginOffset, entity.EndOffset),
            }));
    }

    private applyRedactions(prompt: string, entities: RedactedPiiEntity[]): string {
        let redacted = prompt;
        for (const entity of [...entities].sort((a, b) => b.beginOffset - a.beginOffset)) {
            const replacement =
                this.redactionMode === "mask"
                    ? this.maskCharacter.repeat(entity.endOffset - entity.beginOffset)
                    : this.replacementText ?? `[${entity.type}]`;
            redacted =
                redacted.slice(0, entity.beginOffset) +
                replacement +
                redacted.slice(entity.endOffset);
        }
        return redacted;
    }
}
