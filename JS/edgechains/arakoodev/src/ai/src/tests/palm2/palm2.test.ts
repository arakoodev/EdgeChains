import axios from "axios";
import { Palm2AI } from "../../lib/palm2/palm2";

jest.mock("axios");

describe("Palm2AI", () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    test("should generate text using the default PaLM2 text model", async () => {
        const mockResponse = {
            candidates: [
                {
                    output: "Test response",
                },
            ],
        };

        (axios.request as jest.Mock).mockResolvedValueOnce({ data: mockResponse });

        const palm2 = new Palm2AI({ apiKey: "test_api_key" });
        const response = await palm2.chat({ prompt: "test prompt" });

        expect(axios.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "post",
                url: "https://generativelanguage.googleapis.com/v1beta3/models/text-bison-001:generateText?key=test_api_key",
                headers: {
                    "Content-Type": "application/json",
                },
                data: expect.objectContaining({
                    prompt: {
                        text: "test prompt",
                    },
                    temperature: 0.7,
                    candidate_count: 1,
                    max_output_tokens: 1024,
                }),
            })
        );
        expect(response).toEqual(mockResponse);
    });

    test("should allow overriding generation settings and model", async () => {
        const mockResponse = {
            candidates: [
                {
                    output: "Custom model response",
                },
            ],
        };

        (axios.request as jest.Mock).mockResolvedValueOnce({ data: mockResponse });

        const palm2 = new Palm2AI({
            apiKey: "test_api_key",
            model: "text-bison-001",
            apiVersion: "v1beta3",
        });
        await palm2.chat({
            prompt: "test prompt",
            model: "chat-bison-001",
            temperature: 0.2,
            candidate_count: 2,
            max_output_tokens: 256,
            top_k: 40,
            top_p: 0.95,
            max_retry: 1,
            delay: 1,
        });

        expect(axios.request).toHaveBeenCalledWith(
            expect.objectContaining({
                url: "https://generativelanguage.googleapis.com/v1beta3/models/chat-bison-001:generateText?key=test_api_key",
                data: expect.objectContaining({
                    temperature: 0.2,
                    candidate_count: 2,
                    max_output_tokens: 256,
                    top_k: 40,
                    top_p: 0.95,
                }),
            })
        );
    });
});
