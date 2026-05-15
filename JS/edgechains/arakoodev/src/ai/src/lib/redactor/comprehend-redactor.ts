import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
    PiiEntity,
} from "@aws-sdk/client-comprehend";
import { from, Observable, of } from "rxjs";
import { catchError, map } from "rxjs/operators";

/**
 * Interface representing the result of a redaction operation.
 */
export interface RedactedPrompt {
    /** The original text before redaction */
    original: string;
    /** The text with PII entities replaced by placeholders */
    redacted: string;
    /** Metadata about the entities that were redacted */
    entities: PiiEntity[];
}

/**
 * Options for the ComprehendRedactor.
 */
export interface RedactorOptions {
    /** AWS Region (defaults to environment variable AWS_REGION) */
    region?: string;
    /** Pre-configured ComprehendClient instance */
    client?: ComprehendClient;
    /** Placeholder string for redacted entities (default: "[REDACTED]") */
    placeholder?: string;
    /** Language code for PII detection (default: "en") */
    languageCode?: "en" | "es" | "fr" | "de" | "it" | "pt" | "ar" | "hi" | "ja" | "ko" | "zh" | "zh-TW";
}

/**
 * ComprehendRedactor utility for PII redaction using AWS Comprehend.
 */
export class ComprehendRedactor {
    private client: ComprehendClient;
    private placeholder: string;
    private languageCode: string;

    constructor(options: RedactorOptions = {}) {
        this.client = options.client || new ComprehendClient({ region: options.region });
        this.placeholder = options.placeholder || "[REDACTED]";
        this.languageCode = options.languageCode || "en";
    }

    /**
     * Redacts PII from a prompt (Promise-based).
     * @param text The text to redact.
     * @returns A promise resolving to the RedactedPrompt.
     */
    async redactPrompt(text: string): Promise<RedactedPrompt> {
        if (!text || text.trim().length === 0) {
            return { original: text, redacted: text, entities: [] };
        }

        try {
            const command = new DetectPiiEntitiesCommand({
                Text: text,
                LanguageCode: this.languageCode as any,
            });

            const response = await this.client.send(command);
            const entities = response.Entities || [];

            const redacted = this.applyRedaction(text, entities);

            return {
                original: text,
                redacted,
                entities,
            };
        } catch (error: any) {
            console.error("[ComprehendRedactor] Failed to detect PII entities:", error);
            throw new Error(`PII Redaction failed: ${error.message}`);
        }
    }

    /**
     * Redacts PII from a prompt (Observable-based).
     * @param text The text to redact.
     * @returns An observable emitting the RedactedPrompt.
     */
    redactPrompt$(text: string): Observable<RedactedPrompt> {
        return from(this.redactPrompt(text)).pipe(
            catchError((error) => {
                console.error("[ComprehendRedactor] Observable error:", error);
                throw error;
            })
        );
    }

    /**
     * Internal logic to apply redaction placeholders.
     * Handles overlapping entities and ensures right-to-left replacement to preserve offsets.
     */
    private applyRedaction(text: string, entities: PiiEntity[]): string {
        if (entities.length === 0) return text;

        // 1. Filter out entities with missing offsets and sort by BeginOffset ASC, then EndOffset DESC
        const validEntities = entities
            .filter((e) => e.BeginOffset !== undefined && e.EndOffset !== undefined)
            .sort((a, b) => (a.BeginOffset! - b.BeginOffset!) || (b.EndOffset! - a.EndOffset!));

        // 2. Filter out overlaps (keep leftmost/largest)
        const nonOverlapping: PiiEntity[] = [];
        let lastEnd = -1;

        for (const entity of validEntities) {
            const begin = entity.BeginOffset!;
            const end = entity.EndOffset!;

            if (begin >= lastEnd) {
                nonOverlapping.push(entity);
                lastEnd = end;
            }
        }

        // 3. Sort non-overlapping by BeginOffset descending for right-to-left replacement
        const finalEntities = nonOverlapping.sort((a, b) => b.BeginOffset! - a.BeginOffset!);

        let result = text;
        for (const entity of finalEntities) {
            result = result.slice(0, entity.BeginOffset!) + this.placeholder + result.slice(entity.EndOffset!);
        }

        return result;
    }
}
