import {
    ClaudeTokenizer,
    bytesToUnicode,
    countTokens,
    decodeClaudeTokens,
    encodeClaudeText,
} from "../../lib/tokenizer/claudeTokenizer";

describe("Claude BPE Tokenizer (#233)", () => {
    test("bytesToUnicode maps all 256 byte values bijectively", () => {
        const table = bytesToUnicode();
        expect(table.size).toBe(256);
        const uniqueChars = new Set(table.values());
        expect(uniqueChars.size).toBe(256);
    });

    test("encodes and decodes ASCII, whitespace, and punctuation round-trip", () => {
        const sample = "Hello, Claude! EdgeChains is building with BPE tokenizers.";
        const tokens = encodeClaudeText(sample);
        expect(tokens.length).toBeGreaterThan(0);
        expect(tokens.length).toBeLessThan(sample.length);

        const decoded = decodeClaudeTokens(tokens);
        expect(decoded).toBe(sample);
        expect(countTokens(sample)).toBe(tokens.length);
    });

    test("normalizes Unicode strings to NFC before BPE encoding", () => {
        // 'é' composed (U+00E9) vs decomposed 'e' + combining acute accent (U+0065 U+0301)
        const composed = "caf\u00e9";
        const decomposed = "cafe\u0301";
        expect(composed).not.toBe(decomposed);

        const tokenizer = new ClaudeTokenizer();
        const encodedComposed = tokenizer.encode(composed);
        const encodedDecomposed = tokenizer.encode(decomposed);
        expect(encodedComposed).toEqual(encodedDecomposed);
        expect(tokenizer.decode(encodedDecomposed)).toBe(composed);
    });

    test("supports custom BPE merges and vocabulary entries", () => {
        const tokenizer = new ClaudeTokenizer({
            merges: [
                ["j", "s"],
                ["js", "o"],
                ["jso", "n"],
            ],
        });
        const tokens = tokenizer.encode("json");
        expect(tokens).toHaveLength(1);
        expect(tokenizer.decode(tokens)).toBe("json");
    });

    test("truncates text accurately to a target token limit", () => {
        const tokenizer = new ClaudeTokenizer();
        const text = "The quick brown fox jumps over the lazy dog.";
        const fullTokens = tokenizer.encode(text);
        expect(fullTokens.length).toBeGreaterThan(5);

        const truncated = tokenizer.truncateToTokenLimit(text, 5);
        expect(tokenizer.countTokens(truncated)).toBeLessThanOrEqual(5);
        expect(text.startsWith(truncated)).toBe(true);
    });
});
