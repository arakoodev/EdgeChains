import axios from "axios";
import { Palm2AI } from "../../lib/palm2/palm2";

jest.mock("axios");

describe("Palm2AI", () => {
    afterEach(() => {
        jest.clearAllMocks();
        delete process.env.PALM2_API_KEY;
    });

    describe("chat", () => {
        test("should call the Palm2 generateText endpoint and parse candidates[0].output", async () => {
            const mockResponse = {
                candidates: [
                    {
                        output: "Test response from Palm2",
                        safetyRatings: [
                            {
                                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                                probability: "NEGLIGIBLE",
                            },
                        ],
                    },
                ],
                filters: [],
            };

            const requestSpy = jest
                .fn()
                .mockResolvedValueOnce({ data: mockResponse });
            (axios as any).request = requestSpy;

            const palm2 = new Palm2AI({ apiKey: "test_api_key" });
            const response = await palm2.chat({ prompt: "test prompt" });

            // Response is parsed straight from the generateText payload
            expect(response).toEqual(mockResponse);
            expect(response.candidates[0].output).toEqual("Test response from Palm2");

            // Verify the request hit the real Palm2 generateText endpoint with the api key header
            expect(requestSpy).toHaveBeenCalledTimes(1);
            const config = requestSpy.mock.calls[0][0] as any;
            expect(config.url).toBe(
                "https://generativelanguage.googleapis.com/v1/models/text-bison-001:generateText"
            );
            expect(config.method).toBe("post");
            expect(config.headers["Content-Type"]).toBe("application/json");
            expect(config.headers["x-goog-api-key"]).toBe("test_api_key");

            const body = JSON.parse(config.data);
            expect(body.prompt.text).toBe("test prompt");
            expect(body.temperature).toBe(0.7);
            expect(body.candidateCount).toBe(1);
        });

        test("should allow overriding the model and generation parameters", async () => {
            const mockResponse = { candidates: [{ output: "ok", safetyRatings: [] }], filters: [] };
            const requestSpy = jest.fn().mockResolvedValueOnce({ data: mockResponse });
            (axios as any).request = requestSpy;

            const palm2 = new Palm2AI({ apiKey: "test_api_key" });
            await palm2.chat({
                prompt: "hi",
                model: "text-bison-001",
                temperature: 0.2,
                candidateCount: 2,
                maxTokenCount: 256,
            });

            const config = requestSpy.mock.calls[0][0] as any;
            expect(config.url).toBe(
                "https://generativelanguage.googleapis.com/v1/models/text-bison-001:generateText"
            );
            const body = JSON.parse(config.data);
            expect(body.temperature).toBe(0.2);
            expect(body.candidateCount).toBe(2);
            expect(body.maxTokenCount).toBe(256);
        });

        test("should read the api key from the environment when not provided", async () => {
            process.env.PALM2_API_KEY = "env_api_key";
            const requestSpy = jest
                .fn()
                .mockResolvedValueOnce({ data: { candidates: [], filters: [] } });
            (axios as any).request = requestSpy;

            const palm2 = new Palm2AI({});
            expect(palm2.apiKey).toBe("env_api_key");
            await palm2.chat({ prompt: "hi" });

            const config = requestSpy.mock.calls[0][0] as any;
            expect(config.headers["x-goog-api-key"]).toBe("env_api_key");
        });

        test("should reject when the Palm2 endpoint returns a non-200 response", async () => {
            const requestSpy = jest
                .fn()
                .mockRejectedValue(new Error("Request failed with status code 400"));
            (axios as any).request = requestSpy;

            const palm2 = new Palm2AI({ apiKey: "test_api_key" });
            await expect(
                palm2.chat({ prompt: "hi", max_retry: 1 })
            ).rejects.toThrow("Request failed with status code 400");
            expect(requestSpy).toHaveBeenCalledTimes(1);
        });
    });
});