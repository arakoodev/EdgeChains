import { ComprehendClient, DetectPiiEntitiesCommand, ComprehendClientConfig } from "@aws-sdk/client-comprehend";

export class AwsComprehend {
    private client: ComprehendClient;

    constructor(options?: ComprehendClientConfig) {
        this.client = new ComprehendClient(options || { region: "us-east-1" });
    }

    async redact(text: string, languageCode: string = "en"): Promise<string> {
        if (!text) return text;
        const command = new DetectPiiEntitiesCommand({
            Text: text,
            LanguageCode: languageCode as any
        });
        
        try {
            const response = await this.client.send(command);
            const entities = response.Entities || [];
            
            // Sort entities by BeginOffset in descending order
            // This ensures that string replacement from end to start doesn't affect previous offsets
            entities.sort((a, b) => (b.BeginOffset || 0) - (a.BeginOffset || 0));
            
            let redactedText = text;
            for (const entity of entities) {
                const begin = entity.BeginOffset;
                const end = entity.EndOffset;
                if (begin !== undefined && end !== undefined) {
                    redactedText = redactedText.substring(0, begin) + `[${entity.Type || "PII"}]` + redactedText.substring(end);
                }
            }
            return redactedText;
        } catch (error) {
            console.error("Error redacting text using AWS Comprehend:", error);
            throw error;
        }
    }
}
