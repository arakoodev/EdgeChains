import axios from "axios";
import { describe, expect, it, vi } from "vitest";
import { Palm2AI } from "../../lib/palm2/palm2";

vi.mock("axios", () => ({
    default: {
        post: vi.fn(),
    },
}));

describe("Palm2AI", () => {
    it("sends a prompt to the Palm2 generateMessage endpoint", async () => {
        const mockResponse = {
            candidates: [{ author: "model", content: "Palm2 response" }],
        };
        vi.mocked(axios.post).mockResolvedValueOnce({ data: mockResponse } as never);

        const palm2 = new Palm2AI({ apiKey: "test-api-key" });
        const response = await palm2.chat({
            prompt: "hello palm2",
            model: "chat-bison-001",
        });

        expect(response).toEqual(mockResponse);
        expect(axios.post).toHaveBeenCalledWith(
            "https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:generateMessage",
            expect.objectContaining({
                prompt: {
                    messages: [{ author: "user", content: "hello palm2" }],
                },
            }),
            expect.objectContaining({
                headers: expect.objectContaining({
                    "x-goog-api-key": "test-api-key",
                }),
            }),
        );
    });

    it("uses explicit messages and request tuning options", async () => {
        const mockResponse = {
            candidates: [{ author: "model", content: "ok" }],
        };
        vi.mocked(axios.post).mockResolvedValueOnce({ data: mockResponse } as never);

        const palm2 = new Palm2AI({ apiKey: "test-api-key" });
        await palm2.chat({
            model: "chat-bison-001",
            messages: [
                { author: "user", content: "question" },
                { author: "model", content: "answer" },
            ],
            context: "You are helpful.",
            temperature: 0.2,
            top_p: 0.9,
            top_k: 20,
            candidate_count: 2,
            max_output_tokens: 128,
        });

        expect(axios.post).toHaveBeenCalledWith(
            "https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:generateMessage",
            expect.objectContaining({
                prompt: {
                    context: "You are helpful.",
                    messages: [
                        { author: "user", content: "question" },
                        { author: "model", content: "answer" },
                    ],
                },
                temperature: 0.2,
                top_p: 0.9,
                top_k: 20,
                candidate_count: 2,
                max_output_tokens: 128,
            }),
            expect.any(Object),
        );
    });
});
