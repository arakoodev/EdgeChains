import axios from "axios";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { Palm2AI } from "../../lib/gemini/gemini.js";

vi.mock("axios");

describe("Palm2AI", () => {
    it("sends typed generation settings in the Google request body", async () => {
        const { prompt } = JSON.parse(
            readFileSync(new URL("../../testcases/palm2/prompt.jsonnet", import.meta.url), "utf8")
        ) as { prompt: string };
        const response = { candidates: [], usageMetadata: {} };
        vi.mocked(axios.request).mockResolvedValue({ data: response });

        const palm2 = new Palm2AI({ apiKey: "test-key" });
        await expect(
            palm2.chat({
                model: "gemini-3.5-flash-lite",
                prompt,
                temperature: 0,
                max_output_tokens: 128,
                responseType: "application/json",
                max_retry: 1,
            })
        ).resolves.toBe(response);

        expect(axios.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "post",
                url: expect.stringContaining("/gemini-3.5-flash-lite:generateContent"),
                data: {
                    contents: [
                        {
                            role: "user",
                            parts: [{ text: prompt }],
                        },
                    ],
                    generationConfig: {
                        temperature: 0,
                        responseMimeType: "application/json",
                        maxOutputTokens: 128,
                    },
                },
            })
        );
    });
});
