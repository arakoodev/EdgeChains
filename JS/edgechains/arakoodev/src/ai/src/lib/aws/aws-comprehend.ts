import { ComprehendClient, DetectPiiEntitiesCommand, PiiEntity } from "@aws-sdk/client-comprehend";

export interface AWSComprehendOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
}

export class AwsComprehend {
    private client: ComprehendClient;

    constructor(options: AWSComprehendOptions = {}) {
        const region = options.region || process.env.AWS_REGION || "us-east-1";
        const accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID || "";
        const secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || "";

        this.client = new ComprehendClient({
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
    }

    /**
     * Redacts PII entities from the given text.
     * @param text The text to redact.
     * @param languageCode Language of the text (default: 'en').
     * @returns The redacted text with PII replaced by placeholders like [NAME], [EMAIL], etc.
     */
    async redact(text: string, languageCode: "en" | "es" | "fr" | "de" | "it" | "pt" | "ar" | "hi" | "ja" | "ko" | "zh" | "zh-TW" = "en"): Promise<string> {
        const command = new DetectPiiEntitiesCommand({
            Text: text,
            LanguageCode: languageCode,
        });

        try {
            const response = await this.client.send(command);
            let redactedText = text;
            if (response.Entities) {
                // Sort entities in reverse order by BeginOffset to avoid index shifting issues
                const entities = [...response.Entities].sort((a, b) => (b.BeginOffset || 0) - (a.BeginOffset || 0));

                for (const entity of entities) {
                    const begin = entity.BeginOffset;
                    const end = entity.EndOffset;
                    const type = entity.Type;

                    if (begin !== undefined && end !== undefined && type !== undefined) {
                        redactedText = redactedText.substring(0, begin) + `[${type}]` + redactedText.substring(end);
                    }
                }
            }
            return redactedText;
        } catch (error: any) {
            console.error("AWS Comprehend Redaction Error:", error.message);
            throw error;
        }
    }
}
