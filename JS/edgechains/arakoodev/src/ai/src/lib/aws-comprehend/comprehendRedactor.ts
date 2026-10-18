import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    DetectPiiEntitiesCommandInput,
    PiiEntity,
} from "@aws-sdk/client-comprehend";

export type MaskMode = "redact_label" | "mask" | "placeholder";

export interface AWSComprehendRedactorOptions {
    region?: string;
    credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
    };
    languageCode?: "en" | "es" | "fr" | "de" | "it" | "pt";
    maskMode?: MaskMode;
    placeholder?: string;
    confidenceThreshold?: number;
    client?: ComprehendClient;
}

export interface RedactResult {
    originalText: string;
    redactedText: string;
    entities: PiiEntity[];
    entityCount: number;
}

export class AWSComprehendRedactor {
    private client: ComprehendClient;
    private languageCode: "en" | "es" | "fr" | "de" | "it" | "pt";
    private maskMode: MaskMode;
    private placeholder: string;
    private confidenceThreshold: number;

    constructor(options: AWSComprehendRedactorOptions = {}) {
        this.languageCode = options.languageCode || "en";
        this.maskMode = options.maskMode || "redact_label";
        this.placeholder = options.placeholder || "[REDACTED]";
        this.confidenceThreshold = options.confidenceThreshold ?? 0.7;

        if (options.client) {
            this.client = options.client;
        } else {
            const clientConfig: any = {
                region: options.region || process.env.AWS_REGION || "us-east-1",
            };
            if (options.credentials) {
                clientConfig.credentials = options.credentials;
            }
            this.client = new ComprehendClient(clientConfig);
        }
    }

    /**
     * Detects PII entities in the given text using AWS Comprehend.
     */
    async detectPii(text: string): Promise<PiiEntity[]> {
        if (!text || text.trim().length === 0) {
            return [];
        }

        const input: DetectPiiEntitiesCommandInput = {
            Text: text,
            LanguageCode: this.languageCode,
        };

        try {
            const command = new DetectPiiEntitiesCommand(input);
            const response = await this.client.send(command);

            const entities = response.Entities || [];
            return entities.filter((e) => (e.Score ?? 1.0) >= this.confidenceThreshold);
        } catch (error: any) {
            if (error.name === "CredentialsProviderError" || error.message?.includes("credentials")) {
                console.warn(
                    "[AWSComprehendRedactor] AWS credentials not found. Set AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY in environment to enable live Comprehend detection."
                );
            } else {
                console.error("[AWSComprehendRedactor] Error detecting PII:", error.message || error);
            }
            return [];
        }

    }

    /**
     * Redacts PII entities from the given text based on the selected MaskMode.
     */
    async redact(text: string): Promise<RedactResult> {
        if (!text || text.trim().length === 0) {
            return {
                originalText: text,
                redactedText: text,
                entities: [],
                entityCount: 0,
            };
        }

        const entities = await this.detectPii(text);
        if (entities.length === 0) {
            return {
                originalText: text,
                redactedText: text,
                entities: [],
                entityCount: 0,
            };
        }

        // Sort entities descending by BeginOffset so string replacement does not offset subsequent indices
        const sortedEntities = [...entities].sort((a, b) => (b.BeginOffset ?? 0) - (a.BeginOffset ?? 0));

        let redacted = text;
        for (const entity of sortedEntities) {
            if (entity.BeginOffset !== undefined && entity.EndOffset !== undefined) {
                const replacement = this.getReplacement(entity);
                redacted =
                    redacted.substring(0, entity.BeginOffset) +
                    replacement +
                    redacted.substring(entity.EndOffset);
            }
        }

        return {
            originalText: text,
            redactedText: redacted,
            entities,
            entityCount: entities.length,
        };
    }

    private getReplacement(entity: PiiEntity): string {
        switch (this.maskMode) {
            case "redact_label":
                return `[${entity.Type || "PII"}]`;
            case "placeholder":
                return this.placeholder;
            case "mask": {
                const len = (entity.EndOffset ?? 0) - (entity.BeginOffset ?? 0);
                return "*".repeat(Math.max(len, 4));
            }
            default:
                return "[REDACTED]";
        }
    }

    /**
     * Chains this redactor with an LLM Endpoint (OpenAI, Gemini, Llama).
     * Automatically intercepts and redacts sensitive PII in prompts and messages before forwarding to the model.
     */
    chain<T extends { chat: (options: any) => Promise<any> }>(endpoint: T): T {
        const originalChat = endpoint.chat.bind(endpoint);

        const wrappedChat = async (options: any) => {
            const modifiedOptions = { ...options };

            if (typeof modifiedOptions.prompt === "string") {
                const res = await this.redact(modifiedOptions.prompt);
                modifiedOptions.prompt = res.redactedText;
            }

            if (Array.isArray(modifiedOptions.messages)) {
                modifiedOptions.messages = await Promise.all(
                    modifiedOptions.messages.map(async (msg: any) => {
                        if (msg && typeof msg.content === "string") {
                            const res = await this.redact(msg.content);
                            return { ...msg, content: res.redactedText };
                        }
                        return msg;
                    })
                );
            }

            return originalChat(modifiedOptions);
        };

        return new Proxy(endpoint, {
            get(target: any, prop: string | symbol) {
                if (prop === "chat") {
                    return wrappedChat;
                }
                return target[prop];
            },
        });
    }
}
