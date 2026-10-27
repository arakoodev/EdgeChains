import axios from "axios";
import { Palm2AI } from "../../../../dist/palm2/src/lib/endpoints/Palm2Endpoint.js";

jest.mock("axios");

describe("Palm2AI", () => {
    describe("generateText", () => {
        test("should generate text from Palm2 API", async () => {
            const mockResponse = {
                candidates: [
                    {
                        output: "Test Palm2 response",
                        safetyRatings: [
                            {
                                category: "HARM_CATEGORY_UNSPECIFIED",
                                probability: "NEGLIGIBLE",
                            },
                        ],
                    },
                ],
                filters: [],
                safetyFeedback: [],
            };

            axios.post = jest.fn().mockResolvedValueOnce({ data: mockResponse });
            const palm2 = new Palm2AI({ apiKey: "test_api_key" });
            const response = await palm2.generateText({ prompt: "test prompt" });
            expect(response.content).toEqual("Test Palm2 response");
        });

        test("should use default model when not specified", async () => {
            const mockResponse = {
                candidates: [
                    {
                        output: "Default model response",
                        safetyRatings: [],
                    },
                ],
                filters: [],
                safetyFeedback: [],
            };

            axios.post = jest.fn().mockResolvedValueOnce({ data: mockResponse });
            const palm2 = new Palm2AI({ apiKey: "test_api_key" });
            await palm2.generateText({ prompt: "test prompt" });

            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining("text-bison-001"),
                expect.any(Object),
                expect.any(Object)
            );
        });

        test("should pass all generation parameters", async () => {
            const mockResponse = {
                candidates: [{ output: "Param response", safetyRatings: [] }],
                filters: [],
                safetyFeedback: [],
            };

            axios.post = jest.fn().mockResolvedValueOnce({ data: mockResponse });
            const palm2 = new Palm2AI({ apiKey: "test_api_key" });
            await palm2.generateText({
                prompt: "test prompt",
                model: "text-bison-002",
                temperature: 0.5,
                max_output_tokens: 512,
                top_p: 0.9,
                top_k: 20,
                candidate_count: 2,
            });

            expect(axios.post).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    prompt: { text: "test prompt" },
                    temperature: 0.5,
                    max_output_tokens: 512,
                    top_p: 0.9,
                    top_k: 20,
                    candidate_count: 2,
                }),
                expect.any(Object)
            );
        });

        test("should throw error when no candidates returned", async () => {
            axios.post = jest.fn().mockResolvedValueOnce({
                data: { candidates: [], filters: [], safetyFeedback: [] },
            });
            const palm2 = new Palm2AI({ apiKey: "test_api_key" });

            await expect(palm2.generateText({ prompt: "test prompt" })).rejects.toThrow(
                "No candidates returned from Palm2 API"
            );
        });

        test("should retry on failure", async () => {
            axios.post = jest
                .fn()
                .mockRejectedValueOnce(new Error("Network error"))
                .mockResolvedValueOnce({
                    data: {
                        candidates: [
                            {
                                output: "Retry success",
                                safetyRatings: [],
                            },
                        ],
                        filters: [],
                        safetyFeedback: [],
                    },
                });

            const palm2 = new Palm2AI({ apiKey: "test_api_key" });
            const response = await palm2.generateText({
                prompt: "test prompt",
                max_retry: 2,
            });
            expect(response.content).toEqual("Retry success");
            expect(axios.post).toHaveBeenCalledTimes(2);
        });
    });

    describe("chat", () => {
        test("should alias generateText", async () => {
            const mockResponse = {
                candidates: [{ output: "Chat response", safetyRatings: [] }],
                filters: [],
                safetyFeedback: [],
            };

            axios.post = jest.fn().mockResolvedValueOnce({ data: mockResponse });
            const palm2 = new Palm2AI({ apiKey: "test_api_key" });
            const response = await palm2.chat({ prompt: "hello" });
            expect(response.content).toEqual("Chat response");
        });
    });

    describe("generateEmbeddings", () => {
        test("should generate embeddings from Palm2 API", async () => {
            const mockResponse = {
                embedding: {
                    value: [0.1, 0.2, 0.3],
                },
            };

            axios.post = jest.fn().mockResolvedValueOnce({ data: mockResponse });
            const palm2 = new Palm2AI({ apiKey: "test_api_key" });
            const res = await palm2.generateEmbeddings({
                input: ["test text"],
                model: "embedding-gecko-001",
            });
            expect(res.embedding.value).toEqual([0.1, 0.2, 0.3]);
        });
    });
});
