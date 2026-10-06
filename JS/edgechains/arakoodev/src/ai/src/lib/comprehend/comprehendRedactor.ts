import { ComprehendClient, DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";
import type {
    ComprehendRedactorOptions,
    PiiEntity,
    RedactResult,
    PiiEntityType,
} from "./types.js";

// Deterministic fallback regex patterns for critical PII guards
const FALLBACK_PATTERNS: Array<{ type: PiiEntityType; regex: RegExp }> = [
    { type: "SSN", regex: /\b\d{3}-\d{2}-\d{4}\b/g },
    { type: "EMAIL", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
    { type: "PHONE", regex: /\b(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})\b/g },
    { type: "CREDIT_DEBIT_NUMBER", regex: /\b(?:\d{4}[ -]?){3}\d{4}\b/g },
];

export class AwsComprehendRedactor {
    private client: ComprehendClient;
    private languageCode: string;
    private minScore: number;
    private entityTypes: PiiEntityType[];
    private excludeEntityTypes: PiiEntityType[];
    private maskMode: string;
    private customMask?: string | ((entity: PiiEntity, originalText: string) => string);
    private failClosed: boolean;
    private enableRegexFallback: boolean;

    constructor(options: ComprehendRedactorOptions = {}) {
        this.languageCode = options.languageCode || "en";
        this.minScore = options.minScore !== undefined ? options.minScore : 0.5;
        this.entityTypes = options.entityTypes || [];
        this.excludeEntityTypes = options.excludeEntityTypes || [];
        this.maskMode = options.maskMode || "ENTITY_TYPE";
        this.customMask = options.customMask;
        this.failClosed = options.failClosed !== undefined ? options.failClosed : true;
        this.enableRegexFallback = options.enableRegexFallback !== undefined ? options.enableRegexFallback : true;

        if (options.client) {
            this.client = options.client;
        } else {
            const clientConfig: any = {};
            if (options.region || process.env.AWS_REGION) {
                clientConfig.region = options.region || process.env.AWS_REGION;
            }
            if (options.credentials) {
                clientConfig.credentials = options.credentials;
            } else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
                clientConfig.credentials = {
                    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                    sessionToken: process.env.AWS_SESSION_TOKEN,
                };
            }
            this.client = new ComprehendClient(clientConfig);
        }
    }

    /**
     * Call Amazon Comprehend DetectPiiEntities to extract sensitive entities from text.
     */
    async detectPii(text: string, languageCode?: string): Promise<PiiEntity[]> {
        if (!text || text.trim().length === 0) {
            return [];
        }

        try {
            const command = new DetectPiiEntitiesCommand({
                Text: text,
                LanguageCode: (languageCode || this.languageCode) as any,
            });

            const response = await this.client.send(command);
            const rawEntities = response.Entities || [];

            const filtered: PiiEntity[] = [];

            for (const entity of rawEntities) {
                if (
                    entity.BeginOffset === undefined ||
                    entity.EndOffset === undefined ||
                    !entity.Type
                ) {
                    continue;
                }

                const score = entity.Score ?? 1.0;
                if (score < this.minScore) {
                    continue;
                }

                const entityType = entity.Type as PiiEntityType;

                if (
                    this.entityTypes.length > 0 &&
                    !this.entityTypes.includes("ALL") &&
                    !this.entityTypes.includes(entityType)
                ) {
                    continue;
                }

                if (this.excludeEntityTypes.includes(entityType)) {
                    continue;
                }

                filtered.push({
                    score,
                    type: entityType,
                    beginOffset: entity.BeginOffset,
                    endOffset: entity.EndOffset,
                    text: text.slice(entity.BeginOffset, entity.EndOffset),
                });
            }

            // Merge optional fallback regex detections if enabled
            if (this.enableRegexFallback) {
                this.mergeRegexEntities(text, filtered);
            }

            return filtered;
        } catch (error) {
            if (this.failClosed) {
                const errMessage = error instanceof Error ? error.message : String(error);
                throw new Error(`[AwsComprehendRedactor] Fail-closed: AWS Comprehend detection failed: ${errMessage}`);
            }

            console.warn("[AwsComprehendRedactor] Comprehend call failed; falling back to regex guards.", error);
            if (this.enableRegexFallback) {
                const fallbackEntities: PiiEntity[] = [];
                this.mergeRegexEntities(text, fallbackEntities);
                return fallbackEntities;
            }
            return [];
        }
    }

    /**
     * Redacts PII entities in the provided text deterministically.
     */
    async redact(text: string, languageCode?: string): Promise<RedactResult> {
        if (!text || text.length === 0) {
            return {
                redactedText: text,
                originalText: text,
                entitiesDetected: [],
            };
        }

        const entities = await this.detectPii(text, languageCode);
        if (entities.length === 0) {
            return {
                redactedText: text,
                originalText: text,
                entitiesDetected: [],
            };
        }

        // Sort entities descending by beginOffset to replace text from right to left without shifting left offsets
        const sortedEntities = [...entities].sort((a, b) => {
            if (b.beginOffset !== a.beginOffset) {
                return b.beginOffset - a.beginOffset;
            }
            return b.endOffset - a.endOffset;
        });

        // Filter out overlapping entities (keep the outer / longer one)
        const nonOverlapping: PiiEntity[] = [];
        let lastBegin = Infinity;

        for (const ent of sortedEntities) {
            if (ent.endOffset <= lastBegin) {
                nonOverlapping.push(ent);
                lastBegin = ent.beginOffset;
            }
        }

        let redacted = text;
        for (const entity of nonOverlapping) {
            const mask = this.formatMask(entity, text);
            const prefix = redacted.slice(0, entity.beginOffset);
            const suffix = redacted.slice(entity.endOffset);
            redacted = prefix + mask + suffix;
        }

        return {
            redactedText: redacted,
            originalText: text,
            entitiesDetected: nonOverlapping.reverse(),
        };
    }

    /**
     * Intercepts chat options (such as OpenAIChatOptions or similar) and redacts prompt / messages.
     */
    async redactChatOptions<T extends { prompt?: string; messages?: any[] }>(chatOptions: T): Promise<T> {
        const cloned: any = { ...chatOptions };

        if (typeof cloned.prompt === "string" && cloned.prompt.length > 0) {
            const res = await this.redact(cloned.prompt);
            cloned.prompt = res.redactedText;
        }

        if (Array.isArray(cloned.messages) && cloned.messages.length > 0) {
            const sanitizedMessages: any[] = [];
            for (const msg of cloned.messages) {
                if (typeof msg.content === "string" && msg.content.length > 0) {
                    const res = await this.redact(msg.content);
                    sanitizedMessages.push({
                        ...msg,
                        content: res.redactedText,
                    });
                } else {
                    sanitizedMessages.push({ ...msg });
                }
            }
            cloned.messages = sanitizedMessages;
        }

        return cloned as T;
    }

    /**
     * Computes the replacement mask based on configuration.
     */
    private formatMask(entity: PiiEntity, originalText: string): string {
        switch (this.maskMode) {
            case "REDACTED_LABEL":
                return "[REDACTED]";
            case "ASTERISK": {
                const len = Math.max(1, entity.endOffset - entity.beginOffset);
                return "*".repeat(len);
            }
            case "CUSTOM": {
                if (typeof this.customMask === "function") {
                    return this.customMask(entity, originalText);
                }
                if (typeof this.customMask === "string") {
                    return this.customMask;
                }
                return "[REDACTED]";
            }
            case "ENTITY_TYPE":
            default:
                return `[${entity.type}]`;
        }
    }

    /**
     * Scans text for critical fallback patterns and merges any non-overlapping matches into entities array.
     */
    private mergeRegexEntities(text: string, entities: PiiEntity[]): void {
        for (const pattern of FALLBACK_PATTERNS) {
            if (
                this.entityTypes.length > 0 &&
                !this.entityTypes.includes("ALL") &&
                !this.entityTypes.includes(pattern.type)
            ) {
                continue;
            }
            if (this.excludeEntityTypes.includes(pattern.type)) {
                continue;
            }

            pattern.regex.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = pattern.regex.exec(text)) !== null) {
                const begin = match.index;
                const end = match.index + match[0].length;

                // Check if already covered by an existing entity
                const alreadyCovered = entities.some(
                    (e) => (begin >= e.beginOffset && begin < e.endOffset) ||
                           (end > e.beginOffset && end <= e.endOffset)
                );

                if (!alreadyCovered) {
                    entities.push({
                        score: 1.0,
                        type: pattern.type,
                        beginOffset: begin,
                        endOffset: end,
                        text: match[0],
                    });
                }
            }
        }
    }
}
