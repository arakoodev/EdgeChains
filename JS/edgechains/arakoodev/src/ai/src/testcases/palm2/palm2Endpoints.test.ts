import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";
import axios from "axios";
import { Palm2AI } from "../../lib/palm2/palm2";

vi.mock("axios");

describe("Palm2AI", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    afterEach(() => {
        delete process.env.PALM2_API_KEY;
    });

    describe("chat", () => {
        test("should generate text from the Palm2 generateText endpoint", async () => {
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

            const requestSpy = vi
                .spyOn(axios, "request")
                .mockResolvedValueOnce({ data: mockResponse });

            const palm2 = new Palm2AI({ apiKey: "test_api_key" });
            const response = await palm2.chat({ prompt: "test prompt" });

            expect(response).toEqual(mockResponse);
            expect(response.candidates[0].output).toEqual("Test response from Palm2");

            // Verify the request hit the real Palm2 generateText endpoint with the api key header
            expect(requestSpy).toHaveBeenCalledTimes(1);
            const config = requestSpy.mock.calls[0][0] as any;
            expect(config.url).toBe(
                "https://generativelanguage.googleapis.com/v1/models/text-bison-001:generateText"
            );
            expect(config.method).toBe("post");
            expect(config.headers["x-goog-api-key"]).toBe("test_api_key");
            expect(JSON.parse(config.data).prompt.text).toBe("test prompt");
        });

        test("should allow overriding the model and generation parameters", async () => {
            const mockResponse = { candidates: [{ output: "ok", safetyRatings: [] }], filters: [] };
            const requestSpy = vi
                .spyOn(axios, "request")
                .mockResolvedValueOnce({ data: mockResponse });

            const palm2 = new Palm2AI({ apiKey: "test_api_key" });
            await palm2.chat({ prompt: "hi", model: "text-bison-001", temperature: 0.2 });

            const config = requestSpy.mock.calls[0][0] as any;
            expect(config.url).toBe(
                "https://generativelanguage.googleapis.com/v1/models/text-bison-001:generateText"
            );
            const body = JSON.parse(config.data);
            expect(body.temperature).toBe(0.2);
        });

        test("should read the api key from the environment when not provided", async () => {
            process.env.PALM2_API_KEY = "env_api_key";
            const requestSpy = vi
                .spyOn(axios, "request")
                .mockResolvedValueOnce({ data: { candidates: [], filters: [] } });

            const palm2 = new Palm2AI({});
            expect(palm2.apiKey).toBe("env_api_key");
            await palm2.chat({ prompt: "hi" });

            const config = requestSpy.mock.calls[0][0] as any;
            expect(config.headers["x-goog-api-key"]).toBe("env_api_key");
        });
    });
});