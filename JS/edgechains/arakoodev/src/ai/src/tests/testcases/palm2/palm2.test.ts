import axios from "axios";
import {
    PaLM2Client,
    PALM2_DEFAULT_TEXT_MODEL,
    PALM2_DEFAULT_CHAT_MODEL,
} from "../../../lib/palm2/palm2.js";
import { loadPrompts } from "./prompts.js";

jest.mock("axios");

const mockedAxios = axios as jest.Mocked<typeof axios>;
const prompts = loadPrompts();

describe("PaLM2Client (Google PaLM 2 Endpoint)", () => {
    const apiKey = "test_palm_api_key";

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("generateText", () => {
        test("posts the prompt to the default text model with the api key", async () => {
            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    candidates: [
                        { output: "Paris is the capital of France.", safetyRatings: [] },
                    ],
                },
            });

            const client = new PaLM2Client({ apiKey });
            const response = await client.generateText(prompts.text_prompt);

            expect(mockedAxios.post).toHaveBeenCalledTimes(1);
            const [url, body] = mockedAxios.post.mock.calls[0] as [string, any];
            expect(url).toBe(
                `https://generativelanguage.googleapis.com/v1beta/models/${PALM2_DEFAULT_TEXT_MODEL}:generateText?key=${apiKey}`
            );
            expect(body).toEqual({
                prompt: { text: prompts.text_prompt },
                temperature: undefined,
                candidateCount: undefined,
                maxOutputTokens: undefined,
                topK: undefined,
                topP: undefined,
                stopSequences: undefined,
            });
            expect(response.candidates[0].output).toBe("Paris is the capital of France.");
        });

        test("respects custom model and sampling parameters", async () => {
            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    candidates: [
                        { output: "EdgeChains is a declarative LLM framework.", safetyRatings: [] },
                    ],
                },
            });

            const client = new PaLM2Client({ apiKey });
            const response = await client.generateText(prompts.text_prompt_with_options, {
                model: "text-bison-custom",
                temperature: 0.2,
                candidateCount: 1,
                maxOutputTokens: 100,
                topK: 40,
                topP: 0.95,
            });

            expect(mockedAxios.post).toHaveBeenCalledTimes(1);
            const [url, body] = mockedAxios.post.mock.calls[0] as [string, any];
            expect(url).toContain("models/text-bison-custom:generateText");
            expect(body.temperature).toBe(0.2);
            expect(body.candidateCount).toBe(1);
            expect(body.maxOutputTokens).toBe(100);
            expect(response.candidates[0].output).toBe("EdgeChains is a declarative LLM framework.");
        });
    });

    describe("generateMessage", () => {
        test("posts chat messages to the default chat model", async () => {
            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    candidates: [
                        { content: "42 is the answer to everything.", author: "assistant", safetyRatings: [] },
                    ],
                },
            });

            const client = new PaLM2Client({ apiKey });
            const response = await client.generateMessage(prompts.chat_messages);

            expect(mockedAxios.post).toHaveBeenCalledTimes(1);
            const [url, body] = mockedAxios.post.mock.calls[0] as [string, any];
            expect(url).toBe(
                `https://generativelanguage.googleapis.com/v1beta/models/${PALM2_DEFAULT_CHAT_MODEL}:generateMessage?key=${apiKey}`
            );
            expect(body.prompt.messages).toEqual(prompts.chat_messages);
            expect(response.candidates[0].content).toBe("42 is the answer to everything.");
        });
    });

    describe("chat", () => {
        test("routes single prompt string through chat convenience helper", async () => {
            mockedAxios.post.mockResolvedValueOnce({
                data: {
                    candidates: [
                        { output: "Chat helper response", safetyRatings: [] },
                    ],
                },
            });

            const client = new PaLM2Client({ apiKey });
            const result = await client.chat({ prompt: prompts.text_prompt });
            expect(result).toBe("Chat helper response");
        });
    });
});
