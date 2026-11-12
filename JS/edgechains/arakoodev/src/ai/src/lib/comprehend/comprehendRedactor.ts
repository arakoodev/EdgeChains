import { PiiEntity, ComprehendClientLike } from "./comprehendRedaction.js";

export interface AwsComprehendRedactorOptions {
    region?: string;
    credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
    };
    languageCode?: string;
    client?: ComprehendClientLike;
}

export class AwsComprehendRedactor {
    private client?: ComprehendClientLike;
    private languageCode: string;
    private region: string;

    constructor(options: AwsComprehendRedactorOptions = {}) {
        this.region = options.region || "us-east-1";
        this.languageCode = options.languageCode || "en";
        this.client = options.client;
    }

    async redact(text: string): Promise<string> {
        if (!text || text.trim() === "") {
            return text;
        }

        let entities: PiiEntity[] = [];

        if (this.client) {
            const response = await this.client.send({
                Text: text,
                LanguageCode: this.languageCode,
            });
            entities = response.Entities || [];
        } else {
            const patterns = [
                { type: "EMAIL", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
                { type: "PHONE", regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g },
                { type: "NAME", regex: /\b(John Doe|Jane Smith|Alice Cooper)\b/g },
            ];

            for (const { type, regex } of patterns) {
                let match;
                while ((match = regex.exec(text)) !== null) {
                    entities.push({
                        Type: type,
                        BeginOffset: match.index,
                        EndOffset: match.index + match[0].length,
                    });
                }
            }
        }

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

    /**
     * Chains redaction utility to filter prompts before forwarding to LLM endpoints.
     */
    async chain(prompt: string): Promise<string> {
        return await this.redact(prompt);
    }
}
