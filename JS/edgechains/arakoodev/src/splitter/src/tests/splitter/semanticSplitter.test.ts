import { describe, it, expect } from "vitest";
import { TextSplitter } from "../../lib/text-splitter/textSplitter.js";

describe("TextSplitter (semantic / recursive chunking)", () => {
    const splitter = new TextSplitter();

    describe("splitTextIntoChunks (legacy)", () => {
        it("still splits into fixed-size character chunks", async () => {
            const text = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
            const result = await splitter.splitTextIntoChunks(text, 10);
            expect(result).toEqual([
                "Lorem ipsu",
                "m dolor si",
                "t amet, co",
                "nsectetur ",
                "adipiscing",
                " elit.",
            ]);
        });

        it("handles empty text", async () => {
            expect(await splitter.splitTextIntoChunks("", 10)).toEqual([]);
        });
    });

    describe("splitTextIntoChunksSemantic", () => {
        it("returns empty array for empty text", async () => {
            expect(await splitter.splitTextIntoChunksSemantic("")).toEqual([]);
        });

        it("returns a single chunk when text fits", async () => {
            const text = "A short sentence.";
            const result = await splitter.splitTextIntoChunksSemantic(text, { chunkSize: 100 });
            expect(result).toEqual([text]);
        });

        it("splits on paragraph boundaries preferentially", async () => {
            const text = "First paragraph here.\n\nSecond paragraph here.\n\nThird paragraph.";
            const result = await splitter.splitTextIntoChunksSemantic(text, { chunkSize: 25 });
            // Each paragraph is <= 25 chars, so they should not be merged beyond budget.
            expect(result.length).toBeGreaterThan(1);
            // Re-joining recovers all non-whitespace content.
            expect(result.join("").replace(/\s+/g, " ")).toBe(
                text.replace(/\s+/g, " ")
            );
        });

        it("respects the chunkSize budget", async () => {
            const sentence = "The quick brown fox jumps over the lazy dog. ";
            const text = sentence.repeat(10);
            const chunkSize = 60;
            const result = await splitter.splitTextIntoChunksSemantic(text, { chunkSize });
            for (const chunk of result) {
                expect(chunk.length).toBeLessThanOrEqual(chunkSize);
            }
        });

        it("adds overlap between consecutive chunks", async () => {
            const text = "aaaaaaaa. bbbbbbbb. cccccccc. dddddddd.";
            const result = await splitter.splitTextIntoChunksSemantic(text, {
                chunkSize: 20,
                overlap: 5,
            });
            expect(result.length).toBeGreaterThan(1);
            // Each chunk after the first should begin with the tail of its predecessor.
            for (let i = 1; i < result.length; i++) {
                const prevTail = result[i - 1].slice(-5);
                expect(result[i].startsWith(prevTail)).toBe(true);
            }
        });

        it("hard-slices a single oversized word", async () => {
            const text = "x".repeat(50);
            const result = await splitter.splitTextIntoChunksSemantic(text, { chunkSize: 20 });
            expect(result).toEqual([
                "x".repeat(20),
                "x".repeat(20),
                "x".repeat(10),
            ]);
        });

        it("accepts a numeric chunkSize shorthand", async () => {
            const text = "one two three four five six";
            const result = await splitter.splitTextIntoChunksSemantic(text, 12);
            for (const chunk of result) {
                expect(chunk.length).toBeLessThanOrEqual(12);
            }
        });

        it("rejects overlap >= chunkSize", async () => {
            await expect(
                splitter.splitTextIntoChunksSemantic("some text here", {
                    chunkSize: 10,
                    overlap: 10,
                })
            ).rejects.toThrow();
        });

        it("preserves all content when rejoining (no overlap)", async () => {
            const text =
                "Alpha beta gamma. Delta epsilon zeta. Eta theta iota kappa. Lambda mu nu.";
            const result = await splitter.splitTextIntoChunksSemantic(text, { chunkSize: 30 });
            expect(result.join("").replace(/\s+/g, " ").trim()).toBe(
                text.replace(/\s+/g, " ").trim()
            );
        });
    });
});