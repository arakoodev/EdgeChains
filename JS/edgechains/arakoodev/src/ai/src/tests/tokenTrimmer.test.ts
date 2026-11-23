import { describe, it, expect } from "vitest";
import {
    tokenize,
    joinTokens,
    countTokens,
    trimToTokenLength,
    trimPromptByPriority,
    buildTrimmedPrompt,
    PromptVariable,
} from "../lib/openai/tokenTrimmer.js";

describe("tokenTrimmer", () => {
    describe("tokenize / joinTokens", () => {
        it("round-trips text through tokenize and joinTokens", () => {
            const text = "Hello world, this is a test.";
            expect(joinTokens(tokenize(text))).toBe(text);
        });

        it("returns an empty array for empty input", () => {
            expect(tokenize("")).toEqual([]);
        });

        it("counts tokens approximately by word", () => {
            expect(countTokens("one two three")).toBe(3);
        });
    });

    describe("trimToTokenLength", () => {
        it("keeps the beginning by default (direction=back)", () => {
            const text = "one two three four five";
            const result = trimToTokenLength(text, { maxTokens: 3 });
            expect(result).toBe("one two three ");
        });

        it("keeps the end when direction=start", () => {
            const text = "one two three four five";
            const result = trimToTokenLength(text, { maxTokens: 2, direction: "start" });
            expect(result).toBe("four five");
        });

        it("returns the original text when it already fits", () => {
            const text = "short text";
            expect(trimToTokenLength(text, { maxTokens: 100 })).toBe(text);
        });

        it("returns empty string when maxTokens <= 0", () => {
            expect(trimToTokenLength("anything here", { maxTokens: 0 })).toBe("");
        });
    });

    describe("trimPromptByPriority", () => {
        it("drops the lowest priority variable first", () => {
            const variables: PromptVariable[] = [
                { name: "system", content: "You are helpful.", priority: 10 },
                { name: "context", content: "extra context words here now", priority: 1 },
            ];
            // system = 3 tokens, context = 5 tokens, total = 8. Budget 3 means
            // the 5-token context variable is fully discarded, system survives.
            const result = trimPromptByPriority(variables, { maxTokens: 3 });
            expect(result.map((v) => v.name)).toEqual(["system"]);
            expect(result[0].content).toBe("You are helpful.");
        });

        it("partially trims the lowest priority variable before dropping it", () => {
            const variables: PromptVariable[] = [
                { name: "system", content: "You are helpful.", priority: 10 },
                { name: "context", content: "extra context words here now", priority: 1 },
            ];
            // total = 8, budget = 4 -> overflow 4 removed from context (5 tokens),
            // leaving context with 1 token. Higher priority system is untouched.
            const result = trimPromptByPriority(variables, { maxTokens: 4 });
            const byName = Object.fromEntries(result.map((v) => [v.name, v.content]));
            expect(byName.system).toBe("You are helpful.");
            expect(countTokens(byName.context)).toBe(1);
        });

        it("partially trims a variable when needed", () => {
            const variables: PromptVariable[] = [
                { name: "a", content: "one two three", priority: 5 },
                { name: "b", content: "four five six", priority: 1 },
            ];
            // total 6 tokens, budget 4 -> drop 2 from lowest priority (b).
            const result = trimPromptByPriority(variables, { maxTokens: 4 });
            const joined = result.map((v) => v.content).join("|");
            expect(joined).toBe("one two three|four ");
        });

        it("preserves original order of survivors by default", () => {
            const variables: PromptVariable[] = [
                { name: "first", content: "alpha beta", priority: 1 },
                { name: "second", content: "gamma delta", priority: 9 },
            ];
            const result = trimPromptByPriority(variables, { maxTokens: 2 });
            expect(result.map((v) => v.name)).toEqual(["second"]);
        });

        it("does not mutate the input array", () => {
            const variables: PromptVariable[] = [
                { name: "a", content: "one two three", priority: 1 },
            ];
            const copy = JSON.parse(JSON.stringify(variables));
            trimPromptByPriority(variables, { maxTokens: 1 });
            expect(variables).toEqual(copy);
        });

        it("trims from the start when direction=start", () => {
            const variables: PromptVariable[] = [
                { name: "a", content: "one two three four", priority: 1 },
            ];
            const result = trimPromptByPriority(variables, {
                maxTokens: 2,
                direction: "start",
            });
            expect(result[0].content).toBe("three four");
        });
    });

    describe("buildTrimmedPrompt", () => {
        it("joins surviving variables with newlines", () => {
            const variables: PromptVariable[] = [
                { name: "sys", content: "You are helpful.", priority: 10 },
                { name: "ctx", content: "dropped words here now", priority: 1 },
            ];
            const prompt = buildTrimmedPrompt(variables, { maxTokens: 3 });
            expect(prompt).toBe("You are helpful.");
        });
    });
});