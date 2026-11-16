import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    ContainsPiiEntitiesCommand,
    type PiiEntity,
    type PiiEntityType,
} from "@aws-sdk/client-comprehend";

interface AWSComprehendOptions {
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
}

interface RedactOptions {
    text: string;
    languageCode?: string;
    piiEntityTypes?: PiiEntityType[];
    maskCharacter?: string;
}

interface DetectPiiOptions {
    text: string;
    languageCode?: string;
    piiEntityTypes?: PiiEntityType[];
}

interface ContainsPiiOptions {
    text: string;
    languageCode?: string;
}

interface DetectPiiResult {
    entities: PiiEntity[];
    hasPii: boolean;
}

interface RedactResult {
    redactedText: string;
    entities: PiiEntity[];
    originalText: string;
}

export class AWSComprehend {
    private client: ComprehendClient;

    constructor(options?: AWSComprehendOptions) {
        const region =
            options?.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";

        const credentials =
            options?.accessKeyId && options?.secretAccessKey
                ? {
                      accessKeyId: options.accessKeyId,
                      secretAccessKey: options.secretAccessKey,
                  }
                : undefined;

        this.client = new ComprehendClient({
            region,
            ...(credentials ? { credentials } : {}),
        });
    }

    async detectPiiEntities(options: DetectPiiOptions): Promise<DetectPiiResult> {
        const command = new DetectPiiEntitiesCommand({
            Text: options.text,
            LanguageCode: options.languageCode || "en",
        });

        const response = await this.client.send(command);
        let entities = response.Entities || [];

        if (options.piiEntityTypes && options.piiEntityTypes.length > 0) {
            entities = entities.filter(
                (entity) => entity.Type && options.piiEntityTypes!.includes(entity.Type)
            );
        }

        return {
            entities,
            hasPii: entities.length > 0,
        };
    }

    async containsPii(options: ContainsPiiOptions): Promise<boolean> {
        const command = new ContainsPiiEntitiesCommand({
            Text: options.text,
            LanguageCode: options.languageCode || "en",
        });

        const response = await this.client.send(command);
        return (response.Labels || []).length > 0;
    }

    async redact(options: RedactOptions): Promise<RedactResult> {
        const mask = options.maskCharacter || "*";
        const result = await this.detectPiiEntities({
            text: options.text,
            languageCode: options.languageCode,
            piiEntityTypes: options.piiEntityTypes,
        });

        let redactedText = options.text;

        // Process entities from end to start so offsets remain valid
        const sorted = [...result.entities].sort(
            (a, b) => (b.BeginOffset ?? 0) - (a.BeginOffset ?? 0)
        );

        for (const entity of sorted) {
            if (entity.BeginOffset !== undefined && entity.EndOffset !== undefined) {
                const length = entity.EndOffset - entity.BeginOffset;
                redactedText =
                    redactedText.slice(0, entity.BeginOffset) +
                    mask.repeat(length) +
                    redactedText.slice(entity.EndOffset);
            }
        }

        return {
            redactedText,
            entities: result.entities,
            originalText: options.text,
        };
    }

    async redactPrompt(prompt: string, languageCode?: string): Promise<string> {
        const result = await this.redact({ text: prompt, languageCode });
        return result.redactedText;
    }
}
