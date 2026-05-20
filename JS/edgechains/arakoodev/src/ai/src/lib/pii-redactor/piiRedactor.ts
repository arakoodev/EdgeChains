import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    type ComprehendClientConfig,
    type DetectPiiEntitiesCommandOutput,
    type LanguageCode,
} from "@aws-sdk/client-comprehend";

type PiiEntity = NonNullable<DetectPiiEntitiesCommandOutput["Entities"]>[number];

export interface PIIMessage {
    content: string;
}

export interface PIIRedaction {
    beginOffset: number;
    endOffset: number;
    score?: number;
    text: string;
    type?: string;
}

export interface PIIRedactionResult {
    originalText: string;
    redactedText: string;
    entities: PiiEntity[];
    redactions: PIIRedaction[];
}

export interface RedactableChatOptions {
    prompt?: string;
    messages?: PIIMessage[];
}

export interface ComprehendPIIClient {
    send(command: DetectPiiEntitiesCommand): Promise<DetectPiiEntitiesCommandOutput>;
}

export interface PIIRedactorOptions {
    client?: ComprehendPIIClient;
    comprehendClientConfig?: ComprehendClientConfig;
    languageCode?: LanguageCode;
    minScore?: number;
    redactTypes?: string[];
    replacement?: string | ((redaction: PIIRedaction) => string);
    region?: string;
}

export class PIIRedactor {
    private client: ComprehendPIIClient;
    private languageCode: LanguageCode;
    private minScore: number;
    private redactTypes?: Set<string>;
    private replacement: string | ((redaction: PIIRedaction) => string);

    constructor(options: PIIRedactorOptions = {}) {
        this.client =
            options.client ||
            new ComprehendClient({
                ...options.comprehendClientConfig,
                region: options.region || options.comprehendClientConfig?.region,
            });
        this.languageCode = options.languageCode || "en";
        this.minScore = options.minScore ?? 0;
        this.redactTypes = options.redactTypes ? new Set(options.redactTypes) : undefined;
        this.replacement = options.replacement || "[PII]";
    }

    async redact(text: string): Promise<PIIRedactionResult> {
        if (!text) {
            return {
                originalText: text,
                redactedText: text,
                entities: [],
                redactions: [],
            };
        }

        const response = await this.client.send(
            new DetectPiiEntitiesCommand({
                Text: text,
                LanguageCode: this.languageCode,
            })
        );
        const entities = response.Entities || [];
        const redactions = this.getRedactions(text, entities);

        return {
            originalText: text,
            redactedText: this.applyRedactions(text, redactions),
            entities,
            redactions,
        };
    }

    async redactPrompt(prompt: string): Promise<string> {
        return (await this.redact(prompt)).redactedText;
    }

    async redactMessages<T extends PIIMessage>(messages: T[]): Promise<T[]> {
        return Promise.all(
            messages.map(async (message) => ({
                ...message,
                content: await this.redactPrompt(message.content),
            }))
        );
    }

    async redactChatOptions<T extends RedactableChatOptions>(chatOptions: T): Promise<T> {
        const redactedOptions: T = { ...chatOptions };

        if (chatOptions.prompt) {
            redactedOptions.prompt = await this.redactPrompt(chatOptions.prompt);
        }

        if (chatOptions.messages) {
            redactedOptions.messages = await this.redactMessages(chatOptions.messages);
        }

        return redactedOptions;
    }

    private getRedactions(text: string, entities: PiiEntity[]): PIIRedaction[] {
        const redactions = entities
            .filter((entity) => {
                if (entity.BeginOffset === undefined || entity.EndOffset === undefined) return false;
                if ((entity.Score || 0) < this.minScore) return false;
                if (this.redactTypes && entity.Type && !this.redactTypes.has(entity.Type)) {
                    return false;
                }
                return entity.BeginOffset < entity.EndOffset;
            })
            .map((entity) => ({
                beginOffset: entity.BeginOffset as number,
                endOffset: entity.EndOffset as number,
                score: entity.Score,
                text: text.slice(entity.BeginOffset, entity.EndOffset),
                type: entity.Type,
            }))
            .sort((left, right) => left.beginOffset - right.beginOffset);

        return redactions.reduce<PIIRedaction[]>((mergedRedactions, redaction) => {
            const previous = mergedRedactions[mergedRedactions.length - 1];
            if (!previous || redaction.beginOffset >= previous.endOffset) {
                mergedRedactions.push(redaction);
                return mergedRedactions;
            }

            previous.endOffset = Math.max(previous.endOffset, redaction.endOffset);
            previous.score = Math.max(previous.score || 0, redaction.score || 0);
            previous.text = text.slice(previous.beginOffset, previous.endOffset);
            previous.type = previous.type || redaction.type;
            return mergedRedactions;
        }, []);
    }

    private applyRedactions(text: string, redactions: PIIRedaction[]): string {
        let cursor = 0;
        let redactedText = "";

        for (const redaction of redactions) {
            redactedText += text.slice(cursor, redaction.beginOffset);
            redactedText +=
                typeof this.replacement === "function"
                    ? this.replacement(redaction)
                    : this.replacement;
            cursor = redaction.endOffset;
        }

        return redactedText + text.slice(cursor);
    }
}
