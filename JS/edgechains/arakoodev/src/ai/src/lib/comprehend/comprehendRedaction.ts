import { ComprehendClient, DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";

export interface ComprehendRedactionConfig {
    region: string;
    credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
    };
    languageCode?: string;
    maskCharacter?: string;
}

export class ComprehendRedaction {
    private client: ComprehendClient;
    private languageCode: string;
    private maskCharacter: string;

    constructor(config: ComprehendRedactionConfig) {
        this.client = new ComprehendClient({
            region: config.region,
            credentials: config.credentials,
        });
        this.languageCode = config.languageCode || "en";
        this.maskCharacter = config.maskCharacter || "*";
    }

    async redact(text: string): Promise<string> {
        if (!text || text.trim() === "") {
            return text;
        }

        const command = new DetectPiiEntitiesCommand({
            Text: text,
            LanguageCode: this.languageCode,
        });

        const response = await this.client.send(command);
        const entities = response.Entities || [];

        if (entities.length === 0) {
            return text;
        }

        // Sort entities by BeginOffset in descending order to avoid offset shifts during string replacement
        const sortedEntities = [...entities].sort((a, b) => (b.BeginOffset || 0) - (a.BeginOffset || 0));

        let redactedText = text;
        for (const entity of sortedEntities) {
            const start = entity.BeginOffset;
            const end = entity.EndOffset;
            if (start !== undefined && end !== undefined && start < end && end <= redactedText.length) {
                const originalSubstr = redactedText.substring(start, end);
                const replacement = this.maskCharacter.repeat(originalSubstr.length);
                redactedText = redactedText.substring(0, start) + replacement + redactedText.substring(end);
            }
        }

        return redactedText;
    }

    /**
     * Chains redaction into an existing prompt or payload before endpoint invocation.
     */
    async observe(prompt: string): Promise<string> {
        return await this.redact(prompt);
    }
}
