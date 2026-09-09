import axios from "axios";
import { Palm2AI } from "../../lib/palm2/palm2";

jest.mock("axios");

describe("Palm2AI", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should generate text with PaLM2", async () => {
        const mockResponse = {
            candidates: [
                {
                    output: "Test response",
                },
            ],
        };
        axios.request = jest.fn().mockResolvedValue({ data: mockResponse });

        const palm2 = new Palm2AI({ apiKey: "test_api_key" });
        const response = await palm2.chat({ prompt: "test prompt" });

        expect(response).toEqual(mockResponse);
        expect(axios.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "post",
                url: "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText",
                params: { key: "test_api_key" },
                data: expect.objectContaining({
                    prompt: { text: "test prompt" },
                    maxOutputTokens: 1024,
                }),
            })
        );
    });

    test("should generate embeddings with PaLM2", async () => {
        const mockResponse = {
            embedding: {
                value: [0.1, 0.2, 0.3],
            },
        };
        axios.request = jest.fn().mockResolvedValue({ data: mockResponse });

        const palm2 = new Palm2AI({ apiKey: "test_api_key" });
        const response = await palm2.generateEmbeddings({ text: "test text" });

        expect(response).toEqual(mockResponse);
        expect(axios.request).toHaveBeenCalledWith(
            expect.objectContaining({
                method: "post",
                url: "https://generativelanguage.googleapis.com/v1beta2/models/embedding-gecko-001:embedText",
                params: { key: "test_api_key" },
                data: { text: "test text" },
            })
        );
    });
});
