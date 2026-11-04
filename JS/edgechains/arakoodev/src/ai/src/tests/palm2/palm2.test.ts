import axios from "axios";
import { Palm2AI } from "../../lib/palm2/palm2";

jest.mock("axios");

describe("Palm2AI", () => {
    const apiKey = "test_api_key";

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("should call generateText with the correct payload and return the output", async () => {
        const mockResponse = {
            data: {
                candidates: [
                    {
                        output: "Hello, I am Palm2.",
                        safetyRatings: [],
                        citationMetadata: { citationSources: [] },
                    },
                ],
            },
        };

        (axios.request as jest.Mock).mockResolvedValueOnce(mockResponse);

        const palm2 = new Palm2AI({ apiKey });
        const result = await palm2.generateText({ prompt: "Say hello" });

        expect(axios.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "post",
                url: "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText",
                headers: expect.objectContaining({
                    "x-goog-api-key": apiKey,
                    "Content-Type": "application/json",
                }),
            })
        );
        expect(result).toBe("Hello, I am Palm2.");
    });

    test("should return the full response object from chat", async () => {
        const mockResponse = {
            data: {
                candidates: [
                    {
                        output: "text",
                        safetyRatings: [],
                        citationMetadata: { citationSources: [] },
                    },
                ],
            },
        };

        (axios.request as jest.Mock).mockResolvedValueOnce(mockResponse);

        const palm2 = new Palm2AI({ apiKey });
        const result = await palm2.chat({ prompt: "Say hello" });

        expect(result).toHaveProperty("candidates");
        expect(result.candidates[0].output).toBe("text");
    });

    test("should throw when no candidates are returned", async () => {
        (axios.request as jest.Mock).mockResolvedValueOnce({
            data: { candidates: [] },
        });

        const palm2 = new Palm2AI({ apiKey });
        await expect(palm2.generateText({ prompt: "Say hello" })).rejects.toThrow(
            "Palm2 API returned no candidates."
        );
    });
});
