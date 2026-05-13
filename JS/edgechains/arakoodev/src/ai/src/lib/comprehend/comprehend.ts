import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    PiiEntity,
} from "@aws-sdk/client-comprehend";

export interface AWSComprehendOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
}

export class AWSComprehend {
    private client: ComprehendClient;

    constructor(options: AWSComprehendOptions = {}) {
        this.client = new ComprehendClient({
            region: options.region || process.env.AWS_REGION || "us-east-1",
            credentials: {
                accessKeyId:
                    options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "",
                secretAccessKey:
                    options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "",
            },
        });
    }

    /**
     * Detects PII entities in the given text.
     * @param text The text to analyze.
     * @returns A promise that resolves to an array of PII entities.
     */
    async detectPii(text: string): Promise<PiiEntity[]> {
        const command = new DetectPiiEntitiesCommand({
            Text: text,
            LanguageCode: "en", // Default to English as per AWS Comprehend SDK
        });

        try {
            const response = await this.client.send(command);
            return response.Entities || [];
        } catch (error) {
            console.error("Error detecting PII entities:", error);
            throw error;
        }
    }

    /**
     * Redacts PII entities in the given text by replacing them with placeholders.
     * @param text The text to redact.
     * @param placeholder The placeholder to use (default: "[REDACTED]").
     * @returns A promise that resolves to the redacted text.
     */
    async redact(text: string, placeholder: string = "[REDACTED]"): Promise<string> {
        const entities = await this.detectPii(text);
        if (entities.length === 0) return text;

        // Sort entities by BeginOffset in descending order to avoid offset shifts during replacement
        const sortedEntities = entities.sort((a, b) => (b.BeginOffset || 0) - (a.BeginOffset || 0));

        let redactedText = text;
        for (const entity of sortedEntities) {
            const begin = entity.BeginOffset || 0;
            const end = entity.EndOffset || 0;
            redactedText =
                redactedText.substring(0, begin) +
                placeholder +
                redactedText.substring(end);
        }

        return redactedText;
    }

    /**
     * Chaining helper to redact text before passing it to a downstream function (e.g., an LLM call).
     * @param text The text to redact.
     * @param next The function to call with the redacted text.
     * @returns A promise that resolves to the result of the next function.
     */
    async chain<T>(text: string, next: (redactedText: string) => Promise<T>): Promise<T> {
        const redactedText = await this.redact(text);
        return await next(redactedText);
    }
}
