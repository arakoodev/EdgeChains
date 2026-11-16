import type { Utf8TextChunk } from "./types.js";

function utf8BytesForCodePoint(codePoint: number): number {
    if (codePoint <= 0x7f) {
        return 1;
    }
    if (codePoint <= 0x7ff) {
        return 2;
    }
    if (codePoint <= 0xffff) {
        return 3;
    }
    return 4;
}

function utf16WidthForCodePoint(codePoint: number): number {
    return codePoint > 0xffff ? 2 : 1;
}

/**
 * Convert an Amazon Comprehend offset (Unicode code points) into a JavaScript
 * UTF-16 code-unit index for `String.slice`.
 *
 * Astral characters (emoji) are one Comprehend code point but two JS units;
 * using the raw offset with `slice` shifts later entities and can leave PII.
 * Returns -1 when the offset is past the end of `text`.
 */
export function codePointOffsetToUtf16Index(text: string, codePointOffset: number): number {
    if (codePointOffset <= 0) {
        return 0;
    }

    let utf16Index = 0;
    let codePoints = 0;
    while (utf16Index < text.length && codePoints < codePointOffset) {
        const codePoint = text.codePointAt(utf16Index);
        if (codePoint === undefined) {
            break;
        }
        utf16Index += utf16WidthForCodePoint(codePoint);
        codePoints += 1;
    }
    return codePoints === codePointOffset ? utf16Index : -1;
}

/**
 * Split `text` into chunks whose UTF-8 encoding is at most `maxUtf8Bytes`.
 * Splits on Unicode code-point boundaries (never through a surrogate pair)
 * and prefers whitespace so PII spans are less likely to be cut in half.
 */
export function splitTextByUtf8ByteLimit(text: string, maxUtf8Bytes: number): Utf8TextChunk[] {
    if (!text) {
        return [];
    }
    if (maxUtf8Bytes < 1) {
        throw new Error("maxUtf8Bytes must be at least 1");
    }

    const chunks: Utf8TextChunk[] = [];
    let jsIndex = 0;
    let codePointOffset = 0;

    while (jsIndex < text.length) {
        let end = jsIndex;
        let bytes = 0;
        let codePoints = 0;
        let breakEnd = -1;
        let breakBytes = 0;
        let breakCodePoints = 0;

        while (end < text.length) {
            const codePoint = text.codePointAt(end);
            if (codePoint === undefined) {
                break;
            }
            const charBytes = utf8BytesForCodePoint(codePoint);
            if (bytes + charBytes > maxUtf8Bytes) {
                break;
            }

            const width = utf16WidthForCodePoint(codePoint);
            const char = text.slice(end, end + width);
            bytes += charBytes;
            end += width;
            codePoints += 1;

            if (/\s/u.test(char)) {
                breakEnd = end;
                breakBytes = bytes;
                breakCodePoints = codePoints;
            }
        }

        if (end < text.length && breakEnd > jsIndex && breakBytes >= maxUtf8Bytes / 2) {
            end = breakEnd;
            codePoints = breakCodePoints;
        }

        if (end === jsIndex) {
            const codePoint = text.codePointAt(end);
            if (codePoint === undefined) {
                break;
            }
            end += utf16WidthForCodePoint(codePoint);
            codePoints = 1;
        }

        chunks.push({
            codePointOffset,
            text: text.slice(jsIndex, end),
        });
        jsIndex = end;
        codePointOffset += codePoints;
    }

    return chunks;
}

export function uniqueLabels<T extends { Name?: string; Score?: number }>(labels: T[]): T[] {
    const byName = new Map<string, T>();
    for (const label of labels) {
        const name = label.Name || "";
        const existing = byName.get(name);
        if (!existing || (label.Score || 0) > (existing.Score || 0)) {
            byName.set(name, label);
        }
    }
    return [...byName.values()];
}
