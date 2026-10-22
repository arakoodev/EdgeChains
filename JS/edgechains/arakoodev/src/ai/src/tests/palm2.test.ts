import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Palm2AI } from "../lib/palm2/palm2.js";

vi.mock("axios");

describe("Palm2AI", () => {
    beforeEach(() => vi.clearAllMocks());

    it("calls the PaLM 2 generateText endpoint", async () => {
        vi.mocked(axios.post).mockResolvedValueOnce({
            data: { candidates: [{ output: "hello" }] },
        } as any);

        const client = new Palm2AI({ apiKey: "test-key" });
        const result = await client.chat({
            prompt: "Say hello",
            temperature: 0.2,
            maxOutputTokens: 64,
        });

        expect(axios.post).toHaveBeenCalledWith(
            "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText",
            {
                prompt: { text: "Say hello" },
                temperature: 0.2,
                maxOutputTokens: 64,
            },
            expect.objectContaining({
                headers: expect.objectContaining({ "x-goog-api-key": "test-key" }),
            })
        );
        expect(result.candidates?.[0]?.output).toBe("hello");
    });

    it("rejects empty prompts", async () => {
        const client = new Palm2AI({ apiKey: "test-key" });
        await expect(client.generateText({ prompt: "  " })).rejects.toThrow("prompt is required");
    });
});
