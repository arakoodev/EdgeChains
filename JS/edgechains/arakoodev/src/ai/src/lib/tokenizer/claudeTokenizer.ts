export interface ClaudeBpeConfig {
    vocab?: Record<string, number>;
    merges?: Array<[string, string] | string>;
    normalizeNfc?: boolean;
}

const PAT = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;

/**
 * Builds the reversible byte-to-unicode table used by GPT-2 / Anthropic Claude BPE tokenizers.
 */
export function bytesToUnicode(): Map<number, string> {
    const bs: number[] = [];
    for (let i = "!".charCodeAt(0); i <= "~".charCodeAt(0); i++) bs.push(i);
    for (let i = "¡".charCodeAt(0); i <= "¬".charCodeAt(0); i++) bs.push(i);
    for (let i = "®".charCodeAt(0); i <= "ÿ".charCodeAt(0); i++) bs.push(i);

    const cs: number[] = [...bs];
    let n = 0;
    for (let b = 0; b < 256; b++) {
        if (!bs.includes(b)) {
            bs.push(b);
            cs.push(256 + n);
            n += 1;
        }
    }

    const result = new Map<number, string>();
    for (let i = 0; i < bs.length; i++) {
        result.set(bs[i], String.fromCharCode(cs[i]));
    }
    return result;
}

const DEFAULT_COMMON_MERGES: string[] = [
    "Ġ t",
    "Ġ a",
    "h e",
    "i n",
    "r e",
    "o n",
    "Ġthe",
    "e r",
    "Ġ s",
    "a t",
    "Ġ w",
    "Ġ o",
    "e n",
    "Ġ c",
    "i t",
    "i s",
    "a n",
    "o r",
    "e s",
    "Ġ b",
    "Ġ p",
    "Ġ f",
    "Ġin",
    "o u",
    "Ġto",
    "a l",
    "Ġof",
    "Ġand",
    "i c",
    "a r",
    "Ġis",
    "e d",
    "o m",
    "Ġ m",
    "Ġ d",
    "l e",
    "i on",
    "t h",
    "Ġf or",
    "Ġth at",
    "e nt",
    "v e",
    "Ġw ith",
    "ĠA I",
    "C l",
    "Cl au",
    "Clau de",
    "E d",
    "Ed ge",
    "Edge C",
    "EdgeC h",
    "EdgeCh a",
    "EdgeCha in",
    "EdgeChain s",
].map((m) => {
    const parts = m.split(" ");
    if (parts.length === 2) return m;
    // normalize multi-part shorthand
    return `${parts[0]} ${parts.slice(1).join("")}`;
});

function buildDefaultBpeRanksAndVocab(byteEncoder: Map<number, string>): {
    encoder: Map<string, number>;
    decoder: Map<number, string>;
    bpeRanks: Map<string, number>;
} {
    const encoder = new Map<string, number>();
    const decoder = new Map<number, string>();

    let nextId = 0;
    for (let b = 0; b < 256; b++) {
        const ch = byteEncoder.get(b)!;
        encoder.set(ch, nextId);
        decoder.set(nextId, ch);
        nextId += 1;
    }

    const bpeRanks = new Map<string, number>();
    let rank = 0;
    for (const mergeStr of DEFAULT_COMMON_MERGES) {
        const [first, second] = mergeStr.split(" ");
        if (!first || !second) continue;
        const pairKey = `${first} ${second}`;
        if (!bpeRanks.has(pairKey)) {
            bpeRanks.set(pairKey, rank++);
        }
        const mergedToken = first + second;
        if (!encoder.has(mergedToken)) {
            encoder.set(mergedToken, nextId);
            decoder.set(nextId, mergedToken);
            nextId += 1;
        }
    }

    return { encoder, decoder, bpeRanks };
}

function getPairs(word: string[]): Set<string> {
    const pairs = new Set<string>();
    if (word.length < 2) return pairs;
    let prevChar = word[0];
    for (let i = 1; i < word.length; i++) {
        const char = word[i];
        pairs.add(`${prevChar} ${char}`);
        prevChar = char;
    }
    return pairs;
}

export class ClaudeTokenizer {
    private byteEncoder: Map<number, string>;
    private byteDecoder: Map<string, number>;
    private encoder: Map<string, number>;
    private decoder: Map<number, string>;
    private bpeRanks: Map<string, number>;
    private cache: Map<string, string>;
    private normalizeNfc: boolean;

    constructor(config: ClaudeBpeConfig = {}) {
        this.byteEncoder = bytesToUnicode();
        this.byteDecoder = new Map<string, number>();
        for (const [b, ch] of this.byteEncoder.entries()) {
            this.byteDecoder.set(ch, b);
        }

        this.normalizeNfc = config.normalizeNfc ?? true;
        this.cache = new Map<string, string>();

        const defaults = buildDefaultBpeRanksAndVocab(this.byteEncoder);
        this.encoder = defaults.encoder;
        this.decoder = defaults.decoder;
        this.bpeRanks = defaults.bpeRanks;

        if (config.vocab) {
            for (const [tokenStr, id] of Object.entries(config.vocab)) {
                this.encoder.set(tokenStr, id);
                this.decoder.set(id, tokenStr);
            }
        }

        if (config.merges) {
            this.bpeRanks.clear();
            let nextRank = 0;
            let nextVocabId = Math.max(...Array.from(this.encoder.values()), 255) + 1;
            for (const m of config.merges) {
                const [first, second] = Array.isArray(m) ? m : m.split(" ");
                if (!first || !second) continue;
                const pairKey = `${first} ${second}`;
                if (!this.bpeRanks.has(pairKey)) {
                    this.bpeRanks.set(pairKey, nextRank++);
                }
                const merged = first + second;
                if (!this.encoder.has(merged)) {
                    this.encoder.set(merged, nextVocabId);
                    this.decoder.set(nextVocabId, merged);
                    nextVocabId += 1;
                }
            }
        }
    }

    /**
     * Applies Byte-Pair Encoding (BPE) merges to a single pre-tokenized unicode-mapped token.
     */
    public bpe(token: string): string {
        const cached = this.cache.get(token);
        if (cached !== undefined) {
            return cached;
        }

        let word = Array.from(token);
        let pairs = getPairs(word);
        if (pairs.size === 0) {
            return token;
        }

        while (true) {
            let minRank = Infinity;
            let bigram: string | null = null;

            for (const pair of pairs) {
                const rank = this.bpeRanks.get(pair);
                if (rank !== undefined && rank < minRank) {
                    minRank = rank;
                    bigram = pair;
                }
            }

            if (bigram === null) {
                break;
            }

            const [first, second] = bigram.split(" ");
            const newWord: string[] = [];
            let i = 0;

            while (i < word.length) {
                const j = word.indexOf(first, i);
                if (j === -1) {
                    newWord.push(...word.slice(i));
                    break;
                }
                newWord.push(...word.slice(i, j));
                i = j;

                if (word[i] === first && i < word.length - 1 && word[i + 1] === second) {
                    newWord.push(first + second);
                    i += 2;
                } else {
                    newWord.push(word[i]);
                    i += 1;
                }
            }

            word = newWord;
            if (word.length === 1) {
                break;
            }
            pairs = getPairs(word);
        }

        const joined = word.join(" ");
        this.cache.set(token, joined);
        return joined;
    }

    /**
     * Encodes input text into an array of Claude BPE token IDs (normalizing to NFC first,
     * matching `@anthropic-ai/tokenizer`).
     */
    public encode(text: string): number[] {
        if (!text) return [];
        const normalized = this.normalizeNfc ? text.normalize("NFC") : text;
        const bpeTokens: number[] = [];
        const matches = normalized.match(PAT) || [];

        for (const match of matches) {
            const utf8Bytes = Buffer.from(match, "utf8");
            let mapped = "";
            for (let i = 0; i < utf8Bytes.length; i++) {
                mapped += this.byteEncoder.get(utf8Bytes[i])!;
            }

            const bpeMerged = this.bpe(mapped).split(" ");
            for (const subToken of bpeMerged) {
                const id = this.encoder.get(subToken);
                if (id !== undefined) {
                    bpeTokens.push(id);
                } else {
                    for (const ch of Array.from(subToken)) {
                        const fallbackId = this.encoder.get(ch);
                        if (fallbackId !== undefined) {
                            bpeTokens.push(fallbackId);
                        }
                    }
                }
            }
        }

        return bpeTokens;
    }

    /**
     * Decodes an array of Claude BPE token IDs back into a UTF-8 string.
     */
    public decode(tokens: number[]): string {
        if (!tokens || tokens.length === 0) return "";
        const textChars = tokens.map((id) => this.decoder.get(id) ?? "").join("");
        const byteValues: number[] = [];
        for (const ch of Array.from(textChars)) {
            const b = this.byteDecoder.get(ch);
            if (b !== undefined) {
                byteValues.push(b);
            }
        }
        return Buffer.from(byteValues).toString("utf8");
    }

    /**
     * Returns the string BPE subword pieces for a given input string.
     */
    public tokenize(text: string): string[] {
        if (!text) return [];
        const normalized = this.normalizeNfc ? text.normalize("NFC") : text;
        const matches = normalized.match(PAT) || [];
        const pieces: string[] = [];

        for (const match of matches) {
            const utf8Bytes = Buffer.from(match, "utf8");
            let mapped = "";
            for (let i = 0; i < utf8Bytes.length; i++) {
                mapped += this.byteEncoder.get(utf8Bytes[i])!;
            }
            const bpeMerged = this.bpe(mapped).split(" ");
            for (const subToken of bpeMerged) {
                const bytes: number[] = [];
                for (const ch of Array.from(subToken)) {
                    const b = this.byteDecoder.get(ch);
                    if (b !== undefined) bytes.push(b);
                }
                pieces.push(Buffer.from(bytes).toString("utf8"));
            }
        }
        return pieces;
    }

    /**
     * Counts the number of Claude BPE tokens in `text`.
     */
    public countTokens(text: string): number {
        return this.encode(text).length;
    }

    /**
     * Truncates `text` to at most `maxTokens` BPE tokens.
     */
    public truncateToTokenLimit(text: string, maxTokens: number): string {
        if (maxTokens <= 0 || !text) return "";
        const encoded = this.encode(text);
        if (encoded.length <= maxTokens) return this.normalizeNfc ? text.normalize("NFC") : text;
        return this.decode(encoded.slice(0, maxTokens));
    }
}

let defaultTokenizerInstance: ClaudeTokenizer | null = null;

export function getTokenizer(config?: ClaudeBpeConfig): ClaudeTokenizer {
    if (config) {
        return new ClaudeTokenizer(config);
    }
    if (!defaultTokenizerInstance) {
        defaultTokenizerInstance = new ClaudeTokenizer();
    }
    return defaultTokenizerInstance;
}

export function countTokens(text: string): number {
    return getTokenizer().countTokens(text);
}

export function encodeClaudeText(text: string): number[] {
    return getTokenizer().encode(text);
}

export function decodeClaudeTokens(tokens: number[]): string {
    return getTokenizer().decode(tokens);
}

export { countTokens as countClaudeTokens };
