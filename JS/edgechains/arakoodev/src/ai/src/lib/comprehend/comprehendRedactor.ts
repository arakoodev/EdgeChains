import { ComprehendClient, DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";

export interface AwsComprehendRedactorOptions {
    region: string;
    credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
    };
    languageCode?: string;
}

export class AwsComprehendRedactor {
    private client: ComprehendClient;
    private languageCode: string;

    constructor(options: AwsComprehendRedactorOptions) {
        this.client = new ComprehendClient({
            region: options.region,
            credentials: options.credentials,
        });
        this.languageCode = options.languageCode || "en";
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

        // Sort entities in reverse order of offset to replace strings without shifting indices
        const sortedEntities = [...entities].sort((a, b) => (b.BeginOffset || 0) - (a.BeginOffset || 0));

        let redactedText = text;
        for (const entity of sortedEntities) {
            const start = entity.BeginOffset || 0;
            const end = entity.EndOffset || 0;
            const type = entity.Type || "PII";
            const replacement = `[REDACTED_${type}]`;
            redactedText = redactedText.substring(0, start) + replacement + redactedText.substring(end);
        }

        return redactedText;
    }

    // Observable / chain wrapper method for Endpoint integration
    async chain(prompt: string): Promise<string> {
        return await this.redact(prompt);
    }
}
