import axios from "axios";
import { Palm2 } from "../../../../../dist/ai/src/lib/palm2/palm2.js";

jest.mock("axios");

describe("Palm2", () => {
    describe("chat", () => {
        test("should generate a text completion from PaLM 2", async () => {
            const mockResponse = {
                candidates: [{ output: "Test response", safetyRatings: [] }],
            };
            axios.post = jest.fn().mockResolvedValueOnce({ data: mockResponse });
            const palm2 = new Palm2({ apiKey: "test_api_key" });
            const response = await palm2.chat({ prompt: "test prompt" });
            expect(response.content).toEqual("Test response");
            expect(axios.post).toHaveBeenCalledWith(
                "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText",
                expect.objectContaining({
                    prompt: { text: "test prompt" },
                    candidateCount: 1,
                }),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "x-goog-api-key": "test_api_key",
                    }),
                })
            );
        });

        test("should use a custom model and generation options", async () => {
            const mockResponse = {
                candidates: [{ output: "another", safetyRatings: [] }],
            };
            axios.post = jest.fn().mockResolvedValueOnce({ data: mockResponse });
            const palm2 = new Palm2({ apiKey: "test_api_key" });
            const response = await palm2.chat({
                model: "text-bison-002",
                prompt: "hi",
                temperature: 0.2,
                candidateCount: 2,
                maxOutputTokens: 64,
                topK: 40,
                topP: 0.95,
                stopSequences: ["STOP"],
            });
            expect(response.content).toEqual("another");
            expect(axios.post).toHaveBeenCalledWith(
                "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-002:generateText",
                expect.objectContaining({
                    temperature: 0.2,
                    candidateCount: 2,
                    maxOutputTokens: 64,
                    top_k: 40,
                    top_p: 0.95,
                    stopSequences: ["STOP"],
                }),
                expect.anything()
            );
        });
    });

    describe("generateEmbeddings", () => {
        test("should generate embeddings from PaLM 2", async () => {
            const mockResponse = { embedding: { value: [0.1, 0.2, 0.3] } };
            axios.post = jest.fn().mockResolvedValueOnce({ data: mockResponse });
            const palm2 = new Palm2({ apiKey: "test_api_key" });
            const res = await palm2.generateEmbeddings({ text: "test text" });
            expect(res.embedding.value).toEqual([0.1, 0.2, 0.3]);
            expect(axios.post).toHaveBeenCalledWith(
                "https://generativelanguage.googleapis.com/v1beta2/models/embedding-gecko-001:embedText",
                { text: "test text" },
                expect.objectContaining({
                    headers: expect.objectContaining({
                        "x-goog-api-key": "test_api_key",
                    }),
                })
            );
        });
    });
});
