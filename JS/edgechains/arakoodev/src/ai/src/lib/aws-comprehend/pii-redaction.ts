import { ComprehendClient, DetectPiiEntitiesCommand, PiiEntityType } from "@aws-sdk/client-comprehend";

export type RedactionMode = "REPLACE_WITH_PII_ENTITY_TYPE" | "REPLACE_WITH_CHARACTER";

export interface PIIRedactionOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    redactionMode?: RedactionMode;
    maskCharacter?: string;
    piiEntityTypes?: PiiEntityType[];
    languageCode?: "en" | "es";
    confidenceThreshold?: number;
}

export interface RedactionResult {
    originalText: string;
    redactedText: string;
    entities: PIIEntity[];
}

export interface PIIEntity {
    type: string;
    score: number;
    beginOffset: number;
    endOffset: number;
}

export class PIIRedaction {
    private client: ComprehendClient;
    private redactionMode: RedactionMode;
    private maskCharacter: string;
    private piiEntityTypes: PiiEntityType[] | undefined;
    private languageCode: "en" | "es";
    private confidenceThreshold: number;

    constructor(options: PIIRedactionOptions = {}) {
        const region = options.region || process.env.AWS_REGION || "us-east-1";
        const accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        const secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";

        if (!accessKeyId || !secretAccessKey) {
            console.warn(
                "AWS credentials are missing. Please provide valid AWS credentials via options or set " +
                "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables."
            );
        }

        this.client = new ComprehendClient({
            region,
            credentials: accessKeyId && secretAccessKey ? {
                accessKeyId,
                secretAccessKey,
            } : undefined,
        });

        this.redactionMode = options.redactionMode || "REPLACE_WITH_PII_ENTITY_TYPE";
        this.maskCharacter = options.maskCharacter || "*";
        this.piiEntityTypes = options.piiEntityTypes;
        this.languageCode = options.languageCode || "en";
        this.confidenceThreshold = options.confidenceThreshold ?? 0.5;
    }

    async redact(text: string): Promise<RedactionResult> {
        const command = new DetectPiiEntitiesCommand({
            Text: text,
            LanguageCode: this.languageCode,
        });

        const response = await this.client.send(command);

        let entities: PIIEntity[] = (response.Entities || [])
            .map((entity) => ({
                type: entity.Type || "UNKNOWN",
                score: entity.Score || 0,
                beginOffset: entity.BeginOffset || 0,
                endOffset: entity.EndOffset || 0,
            }))
            .filter((entity) => entity.score >= this.confidenceThreshold);

        // Filter by entity types if specified
        if (this.piiEntityTypes && this.piiEntityTypes.length > 0) {
            entities = entities.filter((entity) =>
                this.piiEntityTypes!.includes(entity.type as PiiEntityType)
            );
        }

        // Sort entities by beginOffset descending so replacement doesn't affect offsets
        const sortedEntities = [...entities].sort((a, b) => b.beginOffset - a.beginOffset);

        let redactedText = text;

        for (const entity of sortedEntities) {
            const before = redactedText.substring(0, entity.beginOffset);
            const after = redactedText.substring(entity.endOffset);

            const replacement =
                this.redactionMode === "REPLACE_WITH_PII_ENTITY_TYPE"
                    ? `[${entity.type}]`
                    : this.maskCharacter.repeat(entity.endOffset - entity.beginOffset);

            redactedText = before + replacement + after;
        }

        return {
            originalText: text,
            redactedText,
            entities,
        };
    }
}

export default PIIRedaction;
