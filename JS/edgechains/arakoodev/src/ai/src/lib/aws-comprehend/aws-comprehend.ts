import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    ContainsPiiEntitiesCommand,
    type PiiEntity,
    type PiiEntityType,
} from "@aws-sdk/client-comprehend";

export interface AWSComprehendOptions {
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
}

export interface RedactOptions {
    text: string;
    languageCode?: string;
    piiEntityTypes?: PiiEntityType[];
    maskCharacter?: string;
    replaceWithEntityType?: boolean;
}

export class AWSComprehend {
    private client: ComprehendClient;

    constructor(options?: AWSComprehendOptions) {
        const region = options?.region || process.env.AWS_REGION || "us-east-1";
        const credentials =
            options?.accessKeyId && options?.secretAccessKey
                ? { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey }
                : undefined;
        this.client = new ComprehendClient({
            region,
            ...(credentials ? { credentials } : {}),
        });
    }

    async detectPiiEntities(text: string, languageCode = "en", piiEntityTypes?: PiiEntityType[]) {
        const command = new DetectPiiEntitiesCommand({ Text: text, LanguageCode: languageCode });
        const response = await this.client.send(command);
        let entities: PiiEntity[] = response.Entities || [];
        if (piiEntityTypes?.length) {
            entities = entities.filter((e) => e.Type && piiEntityTypes.includes(e.Type as PiiEntityType));
        }
        return { entities, hasPii: entities.length > 0 };
    }

    async containsPii(text: string, languageCode = "en"): Promise<boolean> {
        const command = new ContainsPiiEntitiesCommand({ Text: text, LanguageCode: languageCode });
        const response = await this.client.send(command);
        return (response.Labels || []).length > 0;
    }

    async redactPii(options: RedactOptions) {
        const { entities } = await this.detectPiiEntities(
            options.text,
            options.languageCode || "en",
            options.piiEntityTypes
        );
        const sorted = [...entities].sort((a, b) => (b.BeginOffset ?? 0) - (a.BeginOffset ?? 0));
        let redactedText = options.text;
        const mask = options.maskCharacter || "*";
        for (const entity of sorted) {
            if (entity.BeginOffset !== undefined && entity.EndOffset !== undefined) {
                const replacement = options.replaceWithEntityType
                    ? `[${entity.Type}]`
                    : mask.repeat(entity.EndOffset - entity.BeginOffset);
                redactedText =
                    redactedText.slice(0, entity.BeginOffset) +
                    replacement +
                    redactedText.slice(entity.EndOffset);
            }
        }
        return { redactedText, entities, originalText: options.text };
    }
}
