import axios from "axios";

import { Palm2AI } from "../../lib/palm2/palm2.js";

jest.mock("axios");

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Palm2AI", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("generates text with the Palm2 REST API", async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: {
                candidates: [{ output: "hello from palm2" }],
            },
        });

        const palm2 = new Palm2AI({
            apiKey: "test-key",
            baseUrl: "https://generativelanguage.googleapis.com/v1beta2",
        });

        const response = await palm2.generateText({
            prompt: "Say hello",
            temperature: 0.2,
            maxOutputTokens: 64,
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=test-key",
            {
                prompt: {
                    text: "Say hello",
                },
                temperature: 0.2,
                maxOutputTokens: 64,
                topP: undefined,
                topK: undefined,
                candidateCount: undefined,
                safetySettings: undefined,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                },
            }
        );
        expect(response.candidates[0].output).toBe("hello from palm2");
    });

    test("returns the first candidate from chat", async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: {
                candidates: [{ output: "first candidate" }],
            },
        });

        const palm2 = new Palm2AI({ apiKey: "test-key" });
        const response = await palm2.chat({ prompt: "Pick one" });

        expect(response.output).toBe("first candidate");
    });
});
