import { describe, it, expect, vi, beforeEach } from "vitest";
import { ErrorCorrectionChain } from "../lib/error-correction/errorCorrection.js";

/**
 * These tests mock the underlying OpenAI client so the generate → verify →
 * correct loop can be exercised deterministically without network access.
 *
 * The mock client returns a scripted sequence of responses:
 *   - generate  -> an initial (wrong) answer
 *   - verify    -> an INCORRECT verdict with a critique
 *   - correct   -> a corrected (right) answer
 *   - verify    -> a CORRECT verdict
 */
function makeMockClient(responses: string[]) {
    let i = 0;
    return {
        chat: vi.fn(async () => {
            const content = responses[Math.min(i, responses.length - 1)];
            i++;
            return { content };
        }),
    } as any;
}

describe("ErrorCorrectionChain", () => {
    let consoleErrorSpy: any;

    beforeEach(() => {
        // Silence the "API key missing" warning emitted by the OpenAI ctor.
        consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    it("corrects a wrong candidate answer and reports success", async () => {
        const responses = [
            // verify #1 -> incorrect
            "VERDICT: INCORRECT\nCRITIQUE: The arithmetic is wrong; 2+2 is not 5.",
            // correct #1 -> corrected answer
            "The correct answer is 4.",
            // verify #2 -> correct
            "VERDICT: CORRECT\nCRITIQUE: 2+2 equals 4, which is correct.",
        ];
        const client = makeMockClient(responses);
        const chain = new ErrorCorrectionChain({ openaiClient: client, maxIterations: 3 });

        const result = await chain.run({
            problem: "What is 2 + 2?",
            candidateAnswer: "5",
        });

        expect(result.initialAnswer).toBe("5");
        expect(result.answer).toBe("The correct answer is 4.");
        expect(result.isCorrect).toBe(true);
        expect(result.iterations).toBe(2);
        expect(result.history).toHaveLength(2);
        expect(result.history[0].isCorrect).toBe(false);
        expect(result.history[0].answerBefore).toBe("5");
        expect(result.history[0].answerAfter).toBe("The correct answer is 4.");
        expect(result.history[1].isCorrect).toBe(true);
        // generate is skipped because a candidate answer was supplied:
        // 1 verify + 1 correct + 1 verify = 3 chat calls.
        expect(client.chat).toHaveBeenCalledTimes(3);
        consoleErrorSpy.mockRestore();
    });

    it("generates an initial answer when no candidate is supplied", async () => {
        const responses = [
            // generate
            "My first attempt: 6.",
            // verify -> incorrect
            "VERDICT: INCORRECT\nCRITIQUE: 3+3 is not 6... wait, it is. Actually wrong.",
            // correct
            "The correct answer is 6.",
            // verify -> correct
            "VERDICT: CORRECT\nCRITIQUE: Yes, 6 is right.",
        ];
        const client = makeMockClient(responses);
        const chain = new ErrorCorrectionChain({ openaiClient: client, maxIterations: 3 });

        const result = await chain.run({ problem: "What is 3 + 3?" });

        expect(result.initialAnswer).toBe("My first attempt: 6.");
        expect(result.answer).toBe("The correct answer is 6.");
        expect(result.isCorrect).toBe(true);
        // generate + verify + correct + verify = 4 calls
        expect(client.chat).toHaveBeenCalledTimes(4);
        consoleErrorSpy.mockRestore();
    });

    it("stops early when the answer is already correct", async () => {
        const responses = [
            "VERDICT: CORRECT\nCRITIQUE: 7 is the right answer.",
        ];
        const client = makeMockClient(responses);
        const chain = new ErrorCorrectionChain({ openaiClient: client, maxIterations: 3 });

        const result = await chain.run({
            problem: "What is 3 + 4?",
            candidateAnswer: "7",
        });

        expect(result.isCorrect).toBe(true);
        expect(result.iterations).toBe(1);
        expect(result.answer).toBe("7");
        expect(client.chat).toHaveBeenCalledTimes(1);
        consoleErrorSpy.mockRestore();
    });

    it("respects maxIterations and returns the last answer when never correct", async () => {
        // Every verify says INCORRECT, every correct returns a new answer.
        const responses = [
            "VERDICT: INCORRECT\nCRITIQUE: still wrong",
            "answer v2",
            "VERDICT: INCORRECT\nCRITIQUE: still wrong",
            "answer v3",
        ];
        const client = makeMockClient(responses);
        const chain = new ErrorCorrectionChain({ openaiClient: client, maxIterations: 2 });

        const result = await chain.run({
            problem: "hard problem",
            candidateAnswer: "answer v1",
        });

        expect(result.isCorrect).toBe(false);
        expect(result.iterations).toBe(2);
        expect(result.answer).toBe("answer v3");
        consoleErrorSpy.mockRestore();
    });

    it("stops early at a fixed point when correction does not change the answer", async () => {
        const responses = [
            "VERDICT: INCORRECT\nCRITIQUE: wrong",
            "same answer", // correct returns identical text -> fixed point
        ];
        const client = makeMockClient(responses);
        const chain = new ErrorCorrectionChain({ openaiClient: client, maxIterations: 5 });

        const result = await chain.run({
            problem: "p",
            candidateAnswer: "same answer",
        });

        expect(result.iterations).toBe(1);
        expect(result.answer).toBe("same answer");
        // verify + correct = 2 calls, then loop breaks at fixed point
        expect(client.chat).toHaveBeenCalledTimes(2);
        consoleErrorSpy.mockRestore();
    });

    it("throws on an empty problem", async () => {
        const client = makeMockClient([]);
        const chain = new ErrorCorrectionChain({ openaiClient: client });
        await expect(chain.run({ problem: "   " })).rejects.toThrow(/problem/);
        consoleErrorSpy.mockRestore();
    });

    it("verifyAnswer parses a tolerant verdict", async () => {
        const client = makeMockClient(["The answer looks wrong to me, there is a mistake."]);
        const chain = new ErrorCorrectionChain({ openaiClient: client });
        const v = await chain.verifyAnswer("q", "a");
        expect(v.isCorrect).toBe(false);
        consoleErrorSpy.mockRestore();
    });
});