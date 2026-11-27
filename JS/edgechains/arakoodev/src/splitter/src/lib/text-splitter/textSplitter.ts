/**
 * Text splitting utilities.
 *
 * Issue #96 — "implement chunking learnings".
 *
 * The original {@link TextSplitter} only did naive fixed-size character slicing
 * after collapsing newlines, which routinely cut words and paragraphs in half
 * and produced low-quality chunks for downstream embeddings / RAG.
 *
 * This module keeps the original `splitTextIntoChunks` behaviour (for backwards
 * compatibility) and adds smarter strategies:
 *
 *   - {@link splitTextIntoChunksSemantic}: recursive splitting that prefers
 *     natural boundaries (paragraphs -> sentences -> words) and only falls back
 *     to hard character slicing when a single semantic unit is larger than the
 *     requested chunk size. An optional overlap lets context bleed between
 *     neighbouring chunks.
 */

/** Options controlling semantic/recursive chunking. */
export interface SemanticChunkOptions {
    /**
     * Maximum number of characters a chunk may contain before it is split
     * further. Defaults to 1000.
     */
    chunkSize?: number;
    /**
     * Number of characters of overlap to prepend to each chunk (except the
     * first) taken from the tail of the previous chunk. Helps preserve context
     * across boundaries. Defaults to 0.
     */
    overlap?: number;
    /**
     * Separators tried in order of preference. The first separator that yields
     * pieces small enough is used. Defaults to paragraph, sentence, then space.
     */
    separators?: string[];
}

const DEFAULT_SEPARATORS = ["\n\n", "\n", ". ", " "];

export class TextSplitter {
    /**
     * Original fixed-size character splitter. Collapses newlines and slices the
     * text into `chunkSize`-length pieces. Retained for backwards compatibility.
     */
    splitTextIntoChunks(text: string, chunkSize: number): Promise<string[]> {
        return new Promise((resolve, reject) => {
            try {
                text = text.split("\n").join(" ");
                const chunks: string[] = [];
                for (let i = 0; i < text.length; i += chunkSize) {
                    chunks.push(text.substring(i, i + chunkSize));
                }
                resolve(chunks);
            } catch (error) {
                console.error("Error splitting text into chunks:", error);
                reject(error);
            }
        });
    }

    /**
     * Recursively / semantically split text into chunks that respect natural
     * language boundaries.
     *
     * The algorithm is a recursive separator sweep (similar in spirit to
     * LangChain's RecursiveCharacterTextSplitter):
     *   1. Try the highest-priority separator. If splitting on it produces at
     *      least one piece that is still larger than `chunkSize`, recurse into
     *      that piece with the remaining (lower-priority) separators.
     *   2. Otherwise greedily merge adjacent pieces into chunks up to
     *      `chunkSize`, optionally adding `overlap` characters of context.
     *   3. As a last resort, hard-slice any piece that no separator can shrink.
     *
     * @param text The text to split.
     * @param options.chunkSize Maximum characters per chunk (default 1000).
     * @param options.overlap Characters of overlap between chunks (default 0).
     * @param options.separators Separator preference order.
     * @returns A promise resolving to the list of chunks.
     */
    splitTextIntoChunksSemantic(
        text: string,
        options: SemanticChunkOptions | number = {}
    ): Promise<string[]> {
        return new Promise((resolve, reject) => {
            try {
                const opts: SemanticChunkOptions =
                    typeof options === "number" ? { chunkSize: options } : options;
                const chunkSize = opts.chunkSize && opts.chunkSize > 0 ? opts.chunkSize : 1000;
                const overlap = Math.max(0, opts.overlap ?? 0);
                const separators = opts.separators ?? DEFAULT_SEPARATORS;

                if (!text || text.length === 0) {
                    resolve([]);
                    return;
                }
                if (overlap >= chunkSize) {
                    reject(new Error("overlap must be smaller than chunkSize"));
                    return;
                }

                const pieces = this.recursiveSplit(text, chunkSize, separators);
                const merged = this.mergeSplits(pieces, text, chunkSize, overlap);
                resolve(merged);
            } catch (error) {
                console.error("Error splitting text into chunks:", error);
                reject(error);
            }
        });
    }

    /**
     * Recursively split `text` into pieces no larger than `chunkSize` using the
     * given separator preference order.
     */
    private recursiveSplit(text: string, chunkSize: number, separators: string[]): string[] {
        if (text.length <= chunkSize) {
            return text.length > 0 ? [text] : [];
        }
        if (separators.length === 0) {
            // No separators left: hard-slice.
            return this.hardSlice(text, chunkSize);
        }

        const [separator, ...rest] = separators;
        // Keep separator attached to the preceding piece so re-joining is lossless.
        const rawPieces = separator.length > 0 ? text.split(separator) : [text];
        const pieces: string[] = [];
        for (let i = 0; i < rawPieces.length; i++) {
            let piece = rawPieces[i];
            // Re-attach the separator (except after the final piece).
            if (i < rawPieces.length - 1) {
                piece = piece + separator;
            }
            if (piece.length === 0) continue;
            if (piece.length > chunkSize) {
                // This piece is still too big; recurse with weaker separators.
                pieces.push(...this.recursiveSplit(piece, chunkSize, rest));
            } else {
                pieces.push(piece);
            }
        }
        return pieces;
    }

    /**
     * Greedily merge small pieces into chunks up to `chunkSize`, optionally
     * prepending `overlap` characters from the previous chunk's tail.
     */
    private mergeSplits(
        pieces: string[],
        fullText: string,
        chunkSize: number,
        overlap: number
    ): string[] {
        const chunks: string[] = [];
        let current = "";

        const flush = () => {
            if (current.length > 0) {
                chunks.push(current);
            }
        };

        for (const piece of pieces) {
            if (piece.length > chunkSize) {
                // Shouldn't normally happen, but guard against infinite loops.
                flush();
                chunks.push(...this.hardSlice(piece, chunkSize));
                current = "";
                continue;
            }

            const candidate = current + piece;
            if (candidate.length <= chunkSize) {
                current = candidate;
            } else {
                flush();
                if (overlap > 0 && chunks.length > 0) {
                    const prev = chunks[chunks.length - 1];
                    const tail = prev.slice(Math.max(0, prev.length - overlap));
                    current = tail + piece;
                    // If overlap pushed us over budget, drop the overlap.
                    if (current.length > chunkSize) {
                        current = piece;
                    }
                } else {
                    current = piece;
                }
            }
        }
        flush();
        return chunks;
    }

    /** Hard-slice a string into fixed-size pieces. */
    private hardSlice(text: string, chunkSize: number): string[] {
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.substring(i, i + chunkSize));
        }
        return chunks;
    }
}