import { readFile, writeFile } from "node:fs/promises";

export interface ComprehendPiiEntity {
    Type?: string;
    BeginOffset?: number;
    EndOffset?: number;
    Score?: number;
}

export interface DetectPiiEntitiesResponse {
    Entities?: ComprehendPiiEntity[];
}

export interface DetectPiiEntitiesInput {
    Text: string;
    LanguageCode: string;
}

export type ComprehendDetector = (
    input: DetectPiiEntitiesInput
) => Promise<DetectPiiEntitiesResponse>;

export interface AwsComprehendClientLike {
    detectPiiEntities?: (
        input: DetectPiiEntitiesInput
    ) => Promise<DetectPiiEntitiesResponse> | { promise: () => Promise<DetectPiiEntitiesResponse> };
    send?: (command: unknown) => Promise<DetectPiiEntitiesResponse>;
}

export interface ComprehendRedactorOptions {
    client?: AwsComprehendClientLike;
    detector?: ComprehendDetector;
    commandConstructor?: new (input: DetectPiiEntitiesInput) => unknown;
    languageCode?: string;
    minScore?: number;
    replacementText?: string;
    replacementFormatter?: (entity: ComprehendPiiEntity) => string;
}

export interface RedactOptions {
    languageCode?: string;
    minScore?: number;
    replacementText?: string;
    replacementFormatter?: (entity: ComprehendPiiEntity) => string;
}

export interface RedactResult {
    text: string;
    entities: ComprehendPiiEntity[];
}

type PiiRange = Required<Pick<ComprehendPiiEntity, "BeginOffset" | "EndOffset">> &
    ComprehendPiiEntity;

export class ComprehendRedactor {
    private readonly client?: AwsComprehendClientLike;
    private readonly detector?: ComprehendDetector;
    private readonly commandConstructor?: new (input: DetectPiiEntitiesInput) => unknown;
    private readonly languageCode: string;
    private readonly minScore: number;
    private readonly replacementText?: string;
    private readonly replacementFormatter?: (entity: ComprehendPiiEntity) => string;

    constructor(options: ComprehendRedactorOptions = {}) {
        this.client = options.client;
        this.detector = options.detector;
        this.commandConstructor = options.commandConstructor;
        this.languageCode = options.languageCode || "en";
        this.minScore = options.minScore ?? 0;
        this.replacementText = options.replacementText;
        this.replacementFormatter = options.replacementFormatter;

        if (!this.detector && !this.client) {
            throw new Error("ComprehendRedactor requires either a detector or a Comprehend client.");
        }
    }

    async redactText(text: string, options: RedactOptions = {}): Promise<RedactResult> {
        const response = await this.detect({
            Text: text,
            LanguageCode: options.languageCode || this.languageCode,
        });
        const minScore = options.minScore ?? this.minScore;
        const entities = this.validRanges(response.Entities || [], text.length, minScore);
        const redactedText = this.applyRedactions(text, entities, options);

        return {
            text: redactedText,
            entities,
        };
    }

    async redactFile(
        inputPath: string,
        outputPath: string,
        options: RedactOptions = {}
    ): Promise<RedactResult> {
        const text = await readFile(inputPath, "utf8");
        const result = await this.redactText(text, options);
        await writeFile(outputPath, result.text, "utf8");

        return result;
    }

    private async detect(input: DetectPiiEntitiesInput): Promise<DetectPiiEntitiesResponse> {
        if (this.detector) {
            return this.detector(input);
        }

        if (this.client?.detectPiiEntities) {
            const response = this.client.detectPiiEntities(input);
            if ("promise" in response) {
                return response.promise();
            }

            return response;
        }

        if (this.client?.send) {
            const command = this.commandConstructor ? new this.commandConstructor(input) : input;
            return this.client.send(command);
        }

        throw new Error("ComprehendRedactor could not find a supported Comprehend API.");
    }

    private validRanges(
        entities: ComprehendPiiEntity[],
        textLength: number,
        minScore: number
    ): PiiRange[] {
        return entities
            .filter((entity): entity is PiiRange => {
                const begin = entity.BeginOffset;
                const end = entity.EndOffset;
                const score = entity.Score ?? 1;

                return (
                    typeof begin === "number" &&
                    typeof end === "number" &&
                    Number.isInteger(begin) &&
                    Number.isInteger(end) &&
                    begin >= 0 &&
                    end > begin &&
                    end <= textLength &&
                    score >= minScore
                );
            })
            .sort((left, right) => left.BeginOffset - right.BeginOffset);
    }

    private applyRedactions(text: string, entities: PiiRange[], options: RedactOptions): string {
        const occupiedRanges: PiiRange[] = [];
        let redacted = text;

        for (const entity of [...entities].sort((left, right) => right.BeginOffset - left.BeginOffset)) {
            if (occupiedRanges.some((range) => this.overlaps(entity, range))) {
                continue;
            }

            redacted =
                redacted.slice(0, entity.BeginOffset) +
                this.replacementFor(entity, options) +
                redacted.slice(entity.EndOffset);
            occupiedRanges.push(entity);
        }

        return redacted;
    }

    private overlaps(left: PiiRange, right: PiiRange): boolean {
        return left.BeginOffset < right.EndOffset && right.BeginOffset < left.EndOffset;
    }

    private replacementFor(entity: ComprehendPiiEntity, options: RedactOptions): string {
        const formatter = options.replacementFormatter || this.replacementFormatter;

        if (formatter) {
            return formatter(entity);
        }

        const replacementText = options.replacementText ?? this.replacementText;
        if (replacementText !== undefined) {
            return replacementText;
        }

        const type = String(entity.Type || "PII")
            .replace(/[^a-z0-9_]/gi, "_")
            .toUpperCase();
        return `[${type}]`;
    }
}
