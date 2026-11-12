import axios from "axios";
import { retry } from "@lifeomic/attempt";

export type PiiEntityType =
    | "BANK_ACCOUNT_NUMBER"
    | "BANK_ROUTING"
    | "CREDIT_DEBIT_NUMBER"
    | "CREDIT_DEBIT_CVV"
    | "CREDIT_DEBIT_EXPIRY"
    | "PIN"
    | "EMAIL"
    | "ADDRESS"
    | "NAME"
    | "PHONE"
    | "SSN"
    | "DATE_TIME"
    | "PASSPORT_NUMBER"
    | "DRIVER_ID"
    | "URL"
    | "AGE"
    | "USERNAME"
    | "PASSWORD"
    | "AWS_ACCESS_KEY"
    | "AWS_SECRET_KEY"
    | "IP_ADDRESS"
    | "MAC_ADDRESS"
    | "ALL";

export interface PiiEntity {
    score: number;
    type: PiiEntityType | string;
    beginOffset: number;
    endOffset: number;
}

export interface ComprehendConstructionOptions {
    region?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    endpointUrl?: string; // Optional custom endpoint for testing/mocking
    defaultLanguageCode?: string;
    threshold?: number;
}

export interface RedactionOptions {
    languageCode?: string;
    threshold?: number;
    maskMode?: "REPLACE_WITH_TAG" | "REPLACE_WITH_ASTERISK" | "CUSTOM_LABEL";
    customLabel?: string;
    entityTypes?: PiiEntityType[];
    maxRetry?: number;
    delay?: number;
}

export interface RedactionResult {
    originalText: string;
    redactedText: string;
    entitiesDetected: PiiEntity[];
    entityCount: number;
}

export class AWSComprehendRedactor {
    private region: string;
    private accessKeyId?: string;
    private secretAccessKey?: string;
    private sessionToken?: string;
    private endpointUrl?: string;
    private defaultLanguageCode: string;
    private defaultThreshold: number;

    constructor(options: ComprehendConstructionOptions = {}) {
        this.region = options.region || process.env.AWS_REGION || "us-east-1";
        this.accessKeyId = options.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
        this.secretAccessKey = options.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;
        this.sessionToken = options.sessionToken || process.env.AWS_SESSION_TOKEN;
        this.endpointUrl = options.endpointUrl;
        this.defaultLanguageCode = options.defaultLanguageCode || "en";
        this.defaultThreshold = options.threshold !== undefined ? options.threshold : 0.8;
    }

    /**
     * Calls AWS Comprehend DetectPiiEntities API or mock endpoint.
     */
    async detectPiiEntities(
        text: string,
        languageCode: string = this.defaultLanguageCode,
        options: { maxRetry?: number; delay?: number } = {}
    ): Promise<PiiEntity[]> {
        const url = this.endpointUrl || `https://comprehend.${this.region}.amazonaws.com`;

        const payload = {
            Text: text,
            LanguageCode: languageCode,
        };

        const headers: Record<string, string> = {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "Comprehend_20171127.DetectPiiEntities",
        };

        if (this.accessKeyId) {
            headers["x-aws-access-key"] = this.accessKeyId;
        }

        return await retry(
            async () => {
                const response = await axios.post(url, payload, { headers });
                const rawEntities = response.data?.Entities || [];
                return rawEntities.map((e: any) => ({
                    score: e.Score ?? e.score ?? 1.0,
                    type: e.Type ?? e.type ?? "PII",
                    beginOffset: e.BeginOffset ?? e.beginOffset ?? 0,
                    endOffset: e.EndOffset ?? e.endOffset ?? 0,
                }));
            },
            {
                maxAttempts: options.maxRetry || 3,
                delay: options.delay || 100,
            }
        );
    }

    /**
     * Detects and redacts sensitive PII entities from the input text.
     */
    async redact(text: string, options: RedactionOptions = {}): Promise<RedactionResult> {
        const languageCode = options.languageCode || this.defaultLanguageCode;
        const threshold = options.threshold !== undefined ? options.threshold : this.defaultThreshold;
        const maskMode = options.maskMode || "REPLACE_WITH_TAG";
        const allowedTypes = options.entityTypes && options.entityTypes.length > 0
            ? new Set(options.entityTypes)
            : null;

        const entities = await this.detectPiiEntities(text, languageCode, {
            maxRetry: options.maxRetry,
            delay: options.delay,
        });

        // Filter by confidence threshold and specified entity types
        const qualifyingEntities = entities.filter(e => {
            if (e.score < threshold) return false;
            if (allowedTypes && !allowedTypes.has("ALL") && !allowedTypes.has(e.type as PiiEntityType)) {
                return false;
            }
            return true;
        });

        // Sort descending by beginOffset to safely replace strings without invalidating previous offsets
        qualifyingEntities.sort((a, b) => b.beginOffset - a.beginOffset);

        let redacted = text;
        for (const ent of qualifyingEntities) {
            let replacement = "[REDACTED]";
            if (maskMode === "REPLACE_WITH_TAG") {
                replacement = `[${ent.type}]`;
            } else if (maskMode === "REPLACE_WITH_ASTERISK") {
                const len = Math.max(1, ent.endOffset - ent.beginOffset);
                replacement = "*".repeat(len);
            } else if (maskMode === "CUSTOM_LABEL") {
                replacement = options.customLabel || "[REDACTED]";
            }

            redacted =
                redacted.slice(0, ent.beginOffset) +
                replacement +
                redacted.slice(ent.endOffset);
        }

        return {
            originalText: text,
            redactedText: redacted,
            entitiesDetected: qualifyingEntities,
            entityCount: qualifyingEntities.length,
        };
    }

    /**
     * Chains redaction into any EdgeChains Endpoint.
     * Intercepts the prompt, scrubs sensitive data, and passes the sanitized prompt to the LLM.
     */
    async chainWithEndpoint<T = any>(
        endpointInstance: any,
        methodName: string,
        options: Record<string, any>,
        redactionOptions: RedactionOptions = {}
    ): Promise<{ llmResponse: T; redaction: RedactionResult }> {
        const promptText = options.prompt || (options.messages && options.messages[0]?.content) || "";
        const redaction = await this.redact(promptText, redactionOptions);

        const sanitizedOptions = { ...options };
        if (sanitizedOptions.prompt) {
            sanitizedOptions.prompt = redaction.redactedText;
        }
        if (sanitizedOptions.messages && sanitizedOptions.messages.length > 0) {
            sanitizedOptions.messages = sanitizedOptions.messages.map((m: any, idx: number) =>
                idx === sanitizedOptions.messages.length - 1
                    ? { ...m, content: redaction.redactedText }
                    : m
            );
        }

        if (typeof endpointInstance[methodName] !== "function") {
            throw new Error(`Target method ${methodName} does not exist on endpoint`);
        }

        const llmResponse = await endpointInstance[methodName](sanitizedOptions);
        return { llmResponse, redaction };
    }
}
