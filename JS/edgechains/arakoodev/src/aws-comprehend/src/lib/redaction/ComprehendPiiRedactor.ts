import { AwsComprehend } from "../comprehend/AwsComprehend.js";
import {
    ComprehendClientOptions,
    PiiEntity,
    PiiRedactionOptions,
    PiiRedactor,
} from "../../types/index.js";

const DEFAULT_MASK = "[{type}]";

/**
 * Redacts personally identifiable information (PII) detected by Amazon
 * Comprehend. Detected entities are replaced with a mask such as "[EMAIL]".
 *
 * The redactor implements the PiiRedactor contract so it can be used with
 * {@link RedactionObservable} or any other chain that accepts a redactor.
 */
export class ComprehendPiiRedactor implements PiiRedactor {
    private readonly comprehend: AwsComprehend;

    constructor(options: ComprehendClientOptions = {}) {
        this.comprehend = new AwsComprehend(options);
    }

    /**
     * Returns the PII entities found in `text` after applying the options
     * filters (entity types and minimum confidence score).
     */
    async detect(text: string, options: PiiRedactionOptions = {}): Promise<PiiEntity[]> {
        const entities = await this.comprehend.detectPiiEntities(text, options);

        return this.filterEntities(entities, options).sort((a, b) => {
            if (a.beginOffset !== b.beginOffset) {
                return a.beginOffset - b.beginOffset;
            }
            return b.score - a.score;
        });
    }

    /**
     * Returns `text` with all detected PII entities replaced by a mask.
     * Overlapping entities are resolved by keeping the longest span.
     */
    async redact(text: string, options: PiiRedactionOptions = {}): Promise<string> {
        if (!text || text.length === 0) {
            return text;
        }

        const mask = options.mask ?? DEFAULT_MASK;
        const entities = (await this.detect(text, options)).filter(
            (entity) => entity.beginOffset < entity.endOffset && entity.endOffset <= text.length
        );

        // Replace from the last entity to the first so earlier offsets stay valid.
        let redacted = text;
        for (let i = entities.length - 1; i >= 0; i--) {
            const entity = entities[i];
            let replacement = mask;
            if (mask.includes("{type}")) {
                replacement = mask.replace(/\{type\}/g, entity.type.toUpperCase());
            }
            redacted =
                redacted.substring(0, entity.beginOffset) +
                replacement +
                redacted.substring(entity.endOffset);
        }

        return redacted;
    }

    private filterEntities(entities: PiiEntity[], options: PiiRedactionOptions): PiiEntity[] {
        const minScore = options.minScore ?? 0;
        const entityTypes = options.entityTypes ? new Set(options.entityTypes) : null;

        const filtered = entities.filter((entity) => {
            if (entity.score < minScore) {
                return false;
            }
            if (entityTypes && !entityTypes.has(entity.type)) {
                return false;
            }
            return true;
        });

        // Resolve overlaps: keep the longest span of any overlapping cluster.
        const sorted = [...filtered].sort((a, b) => {
            if (a.beginOffset !== b.beginOffset) {
                return a.beginOffset - b.beginOffset;
            }
            return b.score - a.score;
        });

        const nonOverlapping: PiiEntity[] = [];
        for (const entity of sorted) {
            const previous = nonOverlapping[nonOverlapping.length - 1];
            if (previous && entity.beginOffset < previous.endOffset) {
                if (
                    entity.endOffset - entity.beginOffset >
                    previous.endOffset - previous.beginOffset
                ) {
                    nonOverlapping[nonOverlapping.length - 1] = entity;
                }
                continue;
            }
            nonOverlapping.push(entity);
        }

        return nonOverlapping;
    }
}
