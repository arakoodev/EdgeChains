export interface PiiEntity {
    Type?: string;
    Score?: number;
    BeginOffset?: number;
    EndOffset?: number;
}

export interface ComprehendClientLike {
    send(command: any): Promise<{ Entities?: PiiEntity[] }>;
}

export interface ComprehendRedactionConfig {
    region?: string;
    credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
    };
    languageCode?: string;
    maskCharacter?: string;
    client?: ComprehendClientLike;
}

export class ComprehendRedaction {
    private client?: ComprehendClientLike;
    private languageCode: string;
    private maskCharacter: string;
    private region: string;

    constructor(config: ComprehendRedactionConfig = {}) {
        this.region = config.region || "us-east-1";
        this.languageCode = config.languageCode || "en";
        this.maskCharacter = config.maskCharacter || "*";
        this.client = config.client;
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
            // Local regex fallback for common PII patterns when AWS client is not configured
            const patterns = [
                { type: "EMAIL", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
                { type: "PHONE", regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g },
                { type: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
            ];

            for (const { regex } of patterns) {
                let match;
                while ((match = regex.exec(text)) !== null) {
                    entities.push({
                        BeginOffset: match.index,
                        EndOffset: match.index + match[0].length,
                    });
                }
            }
        }

        if (entities.length === 0) {
            return text;
        }

        // Sort entities in descending order to avoid offset drift during string replacement
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
