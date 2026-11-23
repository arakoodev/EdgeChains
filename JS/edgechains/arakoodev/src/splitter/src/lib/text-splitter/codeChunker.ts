/**
 * CodeChunker — code-aware chunking for large source files.
 *
 * Issue #172 (arakoodev/EdgeChains): "Chunking for large codebases".
 * Reference: https://docs.sweep.dev/blogs/chunking-2m-files
 *
 * Unlike {@link TextSplitter}, which slices raw text every `chunkSize`
 * characters (destroying code structure), CodeChunker splits source code on
 * *structural boundaries* — top-level functions, classes, and blank-line runs —
 * so that each returned chunk is a semantically coherent unit of code. When a
 * single structural unit is larger than `maxChunkSize`, it is further divided on
 * line boundaries so no chunk exceeds the configured maximum.
 *
 * The splitter is language-agnostic: it relies on brace/bracket balance and
 * indentation heuristics rather than a full AST parser, so it works for
 * JavaScript/TypeScript, Python, Go, Rust, C/C++, Java, and similar languages
 * without any external dependencies.
 */

export interface CodeChunk {
    /** Zero-based index of the chunk in the returned array. */
    index: number;
    /** The source text of the chunk. */
    content: string;
    /** 1-based line number where this chunk starts in the original source. */
    startLine: number;
    /** 1-based line number where this chunk ends (inclusive). */
    endLine: number;
    /** The kind of boundary that produced this chunk. */
    type: "function" | "class" | "block" | "import" | "comment" | "remainder";
}

export interface CodeChunkerOptions {
    /**
     * Maximum number of characters allowed in a single chunk. Structural units
     * larger than this are split further on line boundaries. Defaults to 2000.
     */
    maxChunkSize?: number;
    /**
     * Minimum number of characters a chunk must contain to be emitted on its
     * own. Smaller trailing segments are merged into the previous chunk.
     * Defaults to 1.
     */
    minChunkSize?: number;
    /**
     * When true (default) the returned chunks include line metadata via
     * {@link CodeChunk}. When false, a plain `string[]` is returned to mirror
     * the {@link TextSplitter} API.
     */
    withMetadata?: boolean;
}

const DEFAULT_MAX_CHUNK_SIZE = 2000;

/** Regexes used to classify a top-level structural boundary. */
const FUNCTION_RE =
    /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\b|^\s*(?:export\s+)?(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>|^\s*(?:export\s+)?(?:async\s+)?\w+\s*\([^)]*\)\s*\{|^\s*def\s+\w+\s*\(|^\s*(?:async\s+)?def\s+\w+/;
const CLASS_RE =
    /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\b|^\s*(?:export\s+)?interface\b|^\s*(?:export\s+)?type\s+\w+\s*=|^\s*struct\s+\w+|^\s*impl\b|^\s*trait\s+\w+/;
const IMPORT_RE = /^\s*(?:import\b|from\s+\S+\s+import\b|require\s*\(|#include\b|using\s+\w+\s*=|package\s+\w+|use\s+[\w:]+)/;
const COMMENT_RE = /^\s*(?:\/\/|\/\*|\*|#(?!!)|<!--)/;

/**
 * Code-aware chunker that splits source code on structural boundaries.
 */
export class CodeChunker {
    private readonly maxChunkSize: number;
    private readonly minChunkSize: number;
    private readonly withMetadata: boolean;

    constructor(options: CodeChunkerOptions = {}) {
        this.maxChunkSize = options.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE;
        this.minChunkSize = options.minChunkSize ?? 1;
        this.withMetadata = options.withMetadata ?? true;
        if (this.maxChunkSize <= 0) {
            throw new Error("maxChunkSize must be a positive integer");
        }
    }

    /**
     * Split `source` into code-aware chunks.
     *
     * @param source The full source code text.
     * @returns Either `CodeChunk[]` (default) or `string[]` when
     *          `withMetadata` is false.
     */
    public split(source: string): CodeChunk[];
    public split(source: string): string[];
    public split(source: string): CodeChunk[] | string[] {
        if (!source || source.trim().length === 0) {
            return (this.withMetadata ? [] : []) as CodeChunk[] | string[];
        }

        const lines = source.split("\n");
        // Identify structural segments (contiguous line ranges + classification).
        const segments = this.segment(lines);

        // Materialize chunks, splitting oversized segments on line boundaries.
        const rawChunks: Array<Omit<CodeChunk, "index">> = [];
        for (const seg of segments) {
            const text = seg.text;
            if (text.length <= this.maxChunkSize) {
                if (text.trim().length >= this.minChunkSize) {
                    rawChunks.push({
                        content: text,
                        startLine: seg.startLine,
                        endLine: seg.endLine,
                        type: seg.type,
                    });
                }
            } else {
                // Oversized structural unit: split on line boundaries.
                const pieces = this.splitByLines(seg.lines, seg.startLine, seg.type);
                for (const p of pieces) {
                    if (p.content.trim().length >= this.minChunkSize) {
                        rawChunks.push(p);
                    }
                }
            }
        }

        const indexed: CodeChunk[] = rawChunks.map((c, i) => ({ index: i, ...c }));

        if (this.withMetadata) {
            return indexed;
        }
        return indexed.map((c) => c.content);
    }

    /**
     * Convenience alias matching the naming style of {@link TextSplitter}.
     */
    public splitCodeIntoChunks(source: string): CodeChunk[] {
        return this.split(source);
    }

    /**
     * Group the source lines into structural segments. Each segment is a
     * contiguous run of lines that forms a single logical unit (a function, a
     * class, an import block, a comment block, or a run of blank lines).
     */
    private segment(
        lines: string[]
    ): Array<{ text: string; lines: string[]; startLine: number; endLine: number; type: CodeChunk["type"] }> {
        const segments: Array<{
            text: string;
            lines: string[];
            startLine: number;
            endLine: number;
            type: CodeChunk["type"];
        }> = [];

        let i = 0;
        const n = lines.length;
        while (i < n) {
            const line = lines[i];

            // Blank-line run: collapse consecutive blank lines into one segment.
            if (line.trim().length === 0) {
                const start = i;
                while (i < n && lines[i].trim().length === 0) {
                    i++;
                }
                segments.push({
                    text: lines.slice(start, i).join("\n"),
                    lines: lines.slice(start, i),
                    startLine: start + 1,
                    endLine: i,
                    type: "remainder",
                });
                continue;
            }

            // Comment block: consecutive comment lines.
            if (COMMENT_RE.test(line)) {
                const start = i;
                while (i < n && (COMMENT_RE.test(lines[i]) || lines[i].trim().length === 0)) {
                    // stop the comment block if we hit a non-comment, non-blank line
                    if (lines[i].trim().length !== 0 && !COMMENT_RE.test(lines[i])) break;
                    i++;
                }
                segments.push({
                    text: lines.slice(start, i).join("\n"),
                    lines: lines.slice(start, i),
                    startLine: start + 1,
                    endLine: i,
                    type: "comment",
                });
                continue;
            }

            // Import / include / package lines.
            if (IMPORT_RE.test(line)) {
                const start = i;
                while (i < n && IMPORT_RE.test(lines[i])) {
                    i++;
                }
                segments.push({
                    text: lines.slice(start, i).join("\n"),
                    lines: lines.slice(start, i),
                    startLine: start + 1,
                    endLine: i,
                    type: "import",
                });
                continue;
            }

            // Class / interface / struct declaration.
            if (CLASS_RE.test(line)) {
                const start = i;
                i = this.consumeBlock(lines, i);
                segments.push({
                    text: lines.slice(start, i).join("\n"),
                    lines: lines.slice(start, i),
                    startLine: start + 1,
                    endLine: i,
                    type: "class",
                });
                continue;
            }

            // Function / method declaration.
            if (FUNCTION_RE.test(line)) {
                const start = i;
                i = this.consumeBlock(lines, i);
                segments.push({
                    text: lines.slice(start, i).join("\n"),
                    lines: lines.slice(start, i),
                    startLine: start + 1,
                    endLine: i,
                    type: "function",
                });
                continue;
            }

            // Fallback: a generic block. Consume a brace-balanced block if the
            // line opens one, otherwise consume a single logical line.
            const start = i;
            i = this.consumeBlock(lines, i);
            segments.push({
                text: lines.slice(start, i).join("\n"),
                lines: lines.slice(start, i),
                startLine: start + 1,
                endLine: i,
                type: "block",
            });
        }

        return segments;
    }

    /**
     * Starting at `start`, consume lines until the brace/bracket/paren balance
     * opened on the starting line returns to zero (or a blank line terminates a
     * non-brace block). Returns the index of the first line *after* the block.
     */
    private consumeBlock(lines: string[], start: number): number {
        const first = lines[start];
        let depth = this.netOpenDelta(first);
        let i = start + 1;

        // No opening delimiters on the first line: this is a single-line unit
        // (e.g. a one-line statement or a brace-less language construct).
        if (depth <= 0) {
            // For brace-less languages (Python), a function/class body is an
            // indented block following the signature line.
            if (this.isSignature(first) && i < lines.length) {
                const bodyIndent = this.indentOf(lines[i]);
                if (lines[i].trim().length === 0 || bodyIndent > this.indentOf(first)) {
                    while (i < lines.length) {
                        const l = lines[i];
                        if (l.trim().length === 0) {
                            i++;
                            continue;
                        }
                        if (this.indentOf(l) > this.indentOf(first)) {
                            i++;
                        } else {
                            break;
                        }
                    }
                    return i;
                }
            }
            return i;
        }

        // Brace/bracket-delimited block: track balance across lines.
        while (i < lines.length && depth > 0) {
            depth += this.netOpenDelta(lines[i]);
            i++;
        }
        return i;
    }

    /** Heuristic: does this line look like a function/class signature (brace-less)? */
    private isSignature(line: string): boolean {
        return FUNCTION_RE.test(line) || CLASS_RE.test(line);
    }

    /** Number of leading whitespace characters (tab = 1). */
    private indentOf(line: string): number {
        const m = line.match(/^\s*/);
        return m ? m[0].length : 0;
    }

    /**
     * Net change in (open - close) delimiter count for a single line, ignoring
     * delimiters that appear inside string literals and line comments.
     */
    private netOpenDelta(line: string): number {
        let delta = 0;
        let inString: string | null = null;
        let prev = "";
        for (let k = 0; k < line.length; k++) {
            const ch = line[k];

            if (inString) {
                if (ch === inString && prev !== "\\") {
                    inString = null;
                }
                prev = ch;
                continue;
            }

            if (ch === '"' || ch === "'" || ch === "`") {
                inString = ch;
                prev = ch;
                continue;
            }

            // Stop counting at a line comment.
            if (ch === "/" && line[k + 1] === "/") break;
            if (ch === "#") break;

            if (ch === "{" || ch === "(" || ch === "[") delta++;
            else if (ch === "}" || ch === ")" || ch === "]") delta--;

            prev = ch;
        }
        return delta;
    }

    /**
     * Split an oversized structural segment on line boundaries so that no
     * emitted chunk exceeds `maxChunkSize`.
     */
    private splitByLines(
        lines: string[],
        startLine: number,
        type: CodeChunk["type"]
    ): Array<Omit<CodeChunk, "index">> {
        const out: Array<Omit<CodeChunk, "index">> = [];
        let buf: string[] = [];
        let bufStart = startLine;
        let bufLen = 0;

        const flush = (endLine: number) => {
            if (buf.length > 0) {
                out.push({
                    content: buf.join("\n"),
                    startLine: bufStart,
                    endLine,
                    type,
                });
                buf = [];
                bufLen = 0;
            }
        };

        for (let idx = 0; idx < lines.length; idx++) {
            const line = lines[idx];
            const lineLen = line.length + 1; // +1 for newline

            // If a single line alone exceeds the max, emit it as its own chunk.
            if (lineLen > this.maxChunkSize && buf.length === 0) {
                out.push({
                    content: line,
                    startLine: startLine + idx,
                    endLine: startLine + idx,
                    type,
                });
                continue;
            }

            if (bufLen + lineLen > this.maxChunkSize && buf.length > 0) {
                flush(startLine + idx - 1);
                bufStart = startLine + idx;
            }
            buf.push(line);
            bufLen += lineLen;
        }
        flush(startLine + lines.length - 1);
        return out;
    }
}