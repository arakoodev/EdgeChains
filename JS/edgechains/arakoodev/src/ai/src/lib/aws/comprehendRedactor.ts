export interface ComprehendPiiEntity {
    Type?: string;
    BeginOffset?: number;
    EndOffset?: number;
    Score?: number;
}

export interface DetectPiiEntitiesCommandInput {
    Text: string;
    LanguageCode: string;
}

export interface DetectPiiEntitiesCommandOutput {
    Entities?: ComprehendPiiEntity[];
}

export interface ComprehendLikeClient {
    detectPiiEntities?: (
        input: DetectPiiEntitiesCommandInput
    ) => Promise<DetectPiiEntitiesCommandOutput>;
    send?: (command: unknown) => Promise<DetectPiiEntitiesCommandOutput>;
}

export interface ComprehendRedactorOptions {
    client: ComprehendLikeClient;
    languageCode?: string;
    replacement?: string | ((entity: ComprehendPiiEntity) => string);
    minScore?: number;
    commandFactory?: (input: DetectPiiEntitiesCommandInput) => unknown;
}

export class ComprehendRedactor {
    private readonly client: ComprehendLikeClient;
    private readonly languageCode: string;
    private readonly replacement: string | ((entity: ComprehendPiiEntity) => string);
    private readonly minScore: number;
    private readonly commandFactory?: (input: DetectPiiEntitiesCommandInput) => unknown;

    constructor(options: ComprehendRedactorOptions) {
        this.client = options.client;
        this.languageCode = options.languageCode || "en";
        this.replacement = options.replacement || ((entity) => `[${entity.Type || "PII"}]`);
        this.minScore = options.minScore ?? 0;
        this.commandFactory = options.commandFactory;
    }

    async redact(text: string): Promise<string> {
        if (!text) {
            return text;
        }

        const input = { Text: text, LanguageCode: this.languageCode };
        const response = await this.detectPiiEntities(input);
        const entities = this.normalizeEntities(response.Entities || [], text.length);

        return entities.reduceRight((redacted, entity) => {
            const replacement =
                typeof this.replacement === "function" ? this.replacement(entity) : this.replacement;
            return `${redacted.slice(0, entity.BeginOffset)}${replacement}${redacted.slice(
                entity.EndOffset
            )}`;
        }, text);
    }

    private async detectPiiEntities(
        input: DetectPiiEntitiesCommandInput
    ): Promise<DetectPiiEntitiesCommandOutput> {
        if (this.client.detectPiiEntities) {
            return this.client.detectPiiEntities(input);
        }

        if (this.client.send && this.commandFactory) {
            return this.client.send(this.commandFactory(input));
        }

        throw new Error("ComprehendRedactor requires detectPiiEntities or send plus commandFactory");
    }

    private normalizeEntities(entities: ComprehendPiiEntity[], textLength: number): Required<ComprehendPiiEntity>[] {
        return entities
            .filter((entity): entity is Required<ComprehendPiiEntity> => {
                if (typeof entity.BeginOffset !== "number" || typeof entity.EndOffset !== "number") {
                    return false;
                }
                if (entity.BeginOffset < 0 || entity.EndOffset > textLength || entity.BeginOffset >= entity.EndOffset) {
                    return false;
                }
                return (entity.Score ?? 1) >= this.minScore;
            })
            .sort((a, b) => a.BeginOffset - b.BeginOffset)
            .reduce<Required<ComprehendPiiEntity>[]>((acc, entity) => {
                const previous = acc[acc.length - 1];
                if (previous && entity.BeginOffset < previous.EndOffset) {
                    if ((entity.Score ?? 0) > (previous.Score ?? 0)) {
                        acc[acc.length - 1] = entity;
                    }
                    return acc;
                }
                acc.push(entity);
                return acc;
            }, []);
    }
}
