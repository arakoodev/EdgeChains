import type { PiiEntity } from "@aws-sdk/client-comprehend";
import { codePointOffsetToUtf16Index } from "./text.js";
import type { MaskMode, RedactPiiOptions, RedactionReplacement } from "./types.js";

export interface LocatedEntity {
    begin: number;
    end: number;
    entity: PiiEntity;
}

export function locateEntities(text: string, entities: PiiEntity[]): LocatedEntity[] {
    return entities
        .map((entity) => {
            const begin = codePointOffsetToUtf16Index(text, entity.BeginOffset || 0);
            const end = codePointOffsetToUtf16Index(
                text,
                entity.EndOffset === undefined ? entity.BeginOffset || 0 : entity.EndOffset
            );
            return { begin, end, entity };
        })
        .filter(({ begin, end }) => begin >= 0 && end >= 0 && end <= text.length && begin < end);
}

/**
 * Drop overlapping PII spans, keeping the longest (then highest-score) match.
 * Prevents a NAME inside an ADDRESS (or similar) from corrupting later offsets.
 */
export function resolveOverlappingEntities(entities: LocatedEntity[]): LocatedEntity[] {
    const sorted = [...entities].sort((left, right) => {
        if (left.begin !== right.begin) {
            return left.begin - right.begin;
        }
        const leftLength = left.end - left.begin;
        const rightLength = right.end - right.begin;
        if (leftLength !== rightLength) {
            return rightLength - leftLength;
        }
        return (right.entity.Score || 0) - (left.entity.Score || 0);
    });

    const accepted: LocatedEntity[] = [];
    for (const candidate of sorted) {
        const overlaps = accepted.some(
            (chosen) => candidate.begin < chosen.end && candidate.end > chosen.begin
        );
        if (!overlaps) {
            accepted.push(candidate);
        }
    }
    return accepted;
}

export function buildReplacement(
    entity: PiiEntity,
    original: string,
    options: {
        maskCharacter: string;
        maskMode: MaskMode;
        replacement?: RedactionReplacement;
    }
): string {
    const { replacement } = options;
    if (typeof replacement === "function") {
        return replacement(entity, original);
    }
    if (typeof replacement === "string") {
        return replacement;
    }
    if (options.maskMode === "MASK") {
        return options.maskCharacter.repeat(original.length);
    }
    return `[${entity.Type || "PII"}]`;
}

export function applyRedactions(
    text: string,
    entities: PiiEntity[],
    options: Pick<RedactPiiOptions, "maskCharacter" | "maskMode" | "replacement"> & {
        maskCharacter: string;
        maskMode: MaskMode;
    }
): string {
    return resolveOverlappingEntities(locateEntities(text, entities))
        .sort((left, right) => right.begin - left.begin)
        .reduce((redactedText, { begin, end, entity }) => {
            const original = redactedText.slice(begin, end);
            const redaction = buildReplacement(entity, original, options);
            return redactedText.slice(0, begin) + redaction + redactedText.slice(end);
        }, text);
}
