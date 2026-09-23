import { ComprehendClient, DetectPiiEntitiesCommand, LanguageCode, PiiEntity as AWSPiiEntity } from "@aws-sdk/client-comprehend";

interface ComprehendConstructionOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
}

export interface PiiEntity {
    Text: string;
    Type: string;
    BeginOffset: number;
    EndOffset: number;
    Score: number;
}

export class Comprehend {
    private client: ComprehendClient;

    constructor(options: ComprehendConstructionOptions = {}) {
        this.client = new ComprehendClient({
            region: options.region || process.env.AWS_REGION || "us-east-1",
            credentials: {
                accessKeyId: options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "",
                secretAccessKey: options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "",
            },
        });
    }

    /**
     * Detects PII entities in the given text.
     * @param text The text to analyze.
     * @param language The language code (default is 'en').
     */
    async detectPiiEntities(text: string, language: LanguageCode = "en"): Promise<PiiEntity[]> {
        const command = new DetectPiiEntitiesCommand({
            Text: text,
            LanguageCode: language,
        });

        try {
            const response = await this.client.send(command);
            return (response.Entities || []).map((entity: any) => ({
                Text: entity.Text || "",
                Type: entity.Type || "",
                BeginOffset: entity.BeginOffset || 0,
                EndOffset: entity.EndOffset || 0,
                Score: entity.Score || 0,
            }));
        } catch (error) {
            console.error("Error detecting PII entities with AWS Comprehend:", error);
            throw error;
        }
    }

    /**
     * Redacts PII entities from the text.
     * @param text The text to redact.
     * @param entitiesToRedact Optional list of entity types to redact (e.g., ["NAME", "EMAIL"]). If empty, redacts all.
     * @param language The language code (default is 'en').
     */
    async redact(text: string, entitiesToRedact: string[] = [], language: LanguageCode = "en"): Promise<string> {
        const entities = await this.detectPiiEntities(text, language);
        
        // Sort entities in reverse order to avoid offset shifts while replacing
        const sortedEntities = [...entities].sort((a, b) => b.BeginOffset - a.BeginOffset);
        
        let redactedText = text;
        for (const entity of sortedEntities) {
            if (entitiesToRedact.length === 0 || entitiesToRedact.includes(entity.Type)) {
                const placeholder = `[${entity.Type}]`;
                redactedText = 
                    redactedText.slice(0, entity.BeginOffset) + 
                    placeholder + 
                    redactedText.slice(entity.EndOffset);
            }
        }
        
        return redactedText;
    }
}
