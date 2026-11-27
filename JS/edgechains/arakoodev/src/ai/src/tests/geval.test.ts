import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import {
    GevalEvaluator,
    buildGevalPrompt,
    parseGevalResponse,
    GEVAL_ASPECT_DEFINITIONS,
} from "../lib/geval/geval.js";

vi.mock("axios");

describe("buildGevalPrompt", () => {
    it("includes the aspect definition, prompt and response", () => {
        const prompt = buildGevalPrompt({
            prompt: "What is the capital of France?",
            response: "The capital of France is Paris.",
            aspect: "coherence",
        });
        expect(prompt).toContain("coherence");
        expect(prompt).toContain(GEVAL_ASPECT_DEFINITIONS.coherence);
        expect(prompt).toContain("What is the capital of France?");
        expect(prompt).toContain("The capital of France is Paris.");
        expect(prompt).toContain("Score:");
    });

    it("includes source context when provided", () => {
        const prompt = buildGevalPrompt({
            prompt: "Summarize",
            response: "Summary text",
            context: "Paris is the capital of France.",
            aspect: "consistency",
        });
        expect(prompt).toContain("Source Information:");
        expect(prompt).toContain("Paris is the capital of France.");
    });

    it("supports a custom aspect definition", () => {
        const prompt = buildGevalPrompt({
            prompt: "p",
            response: "r",
            aspect: "relevance",
            customAspectDefinition: "CUSTOM_DEF",
        });
        expect(prompt).toContain("CUSTOM_DEF");
    });
});

describe("parseGevalResponse", () => {
    it("parses the canonical Justification/Score format", () => {
        const raw =
            "Justification: The response is well structured and directly answers the question.\nScore: 5";
        const result = parseGevalResponse(raw, "coherence");
        expect(result.score).toBe(5);
        expect(result.aspect).toBe("coherence");
        expect(result.reasoning).toContain("well structured");
    });

    it("parses a score written as N/5", () => {
        const raw = "Justification: Mostly accurate.\nScore: 4/5";
        const result = parseGevalResponse(raw, "consistency");
        expect(result.score).toBe(4);
    });

    it("parses markdown-bold scores", () => {
        const raw = "**Justification:** Good grammar.\n**Score:** 3";
        const result = parseGevalResponse(raw, "fluency");
        expect(result.score).toBe(3);
    });

    it("falls back to the last standalone 1-5 digit", () => {
        const raw = "The response has some issues and I would rate it a 2 overall.";
        const result = parseGevalResponse(raw, "relevance");
        expect(result.score).toBe(2);
    });

    it("returns score 0 when nothing parseable", () => {
        const result = parseGevalResponse("no numbers here at all", "coherence");
        expect(result.score).toBe(0);
    });
});

describe("GevalEvaluator.evaluate", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("calls the OpenAI chat endpoint and returns a parsed score", async () => {
        const judgeOutput =
            "Justification: The response accurately and fluently answers the prompt.\nScore: 5";
        (axios.post as any).mockResolvedValueOnce({
            data: { choices: [{ message: { content: judgeOutput } }] },
        });

        const evaluator = new GevalEvaluator({ apiKey: "test_key", model: "gpt-3.5-turbo" });
        const result = await evaluator.evaluate({
            prompt: "What is 2+2?",
            response: "2+2 equals 4.",
            aspect: "coherence",
        });

        expect(axios.post).toHaveBeenCalledTimes(1);
        const [url, body, config] = (axios.post as any).mock.calls[0];
        expect(url).toContain("chat/completions");
        expect(body.model).toBe("gpt-3.5-turbo");
        expect(body.messages[0].content).toContain("coherence");
        expect(config.headers.Authorization).toBe("Bearer test_key");

        expect(result.score).toBe(5);
        expect(result.aspect).toBe("coherence");
        expect(result.reasoning).toContain("accurately");
    });

    it("evaluateAll scores across all four aspects and averages", async () => {
        const outputs = [
            "Justification: a\nScore: 4",
            "Justification: b\nScore: 3",
            "Justification: c\nScore: 5",
            "Justification: d\nScore: 2",
        ];
        (axios.post as any)
            .mockResolvedValueOnce({ data: { choices: [{ message: { content: outputs[0] } }] } })
            .mockResolvedValueOnce({ data: { choices: [{ message: { content: outputs[1] } }] } })
            .mockResolvedValueOnce({ data: { choices: [{ message: { content: outputs[2] } }] } })
            .mockResolvedValueOnce({ data: { choices: [{ message: { content: outputs[3] } }] } });

        const evaluator = new GevalEvaluator({ apiKey: "test_key" });
        const { results, average } = await evaluator.evaluateAll({
            prompt: "prompt",
            response: "response",
        });

        expect(results).toHaveLength(4);
        expect(results.map((r) => r.aspect)).toEqual([
            "coherence",
            "consistency",
            "fluency",
            "relevance",
        ]);
        expect(average).toBeCloseTo((4 + 3 + 5 + 2) / 4, 5);
    });

    it("throws when the underlying request fails", async () => {
        (axios.post as any).mockRejectedValueOnce(new Error("network"));
        const evaluator = new GevalEvaluator({ apiKey: "test_key" });
        await expect(
            evaluator.evaluate({ prompt: "p", response: "r", aspect: "coherence" })
        ).rejects.toThrow("network");
    });
});