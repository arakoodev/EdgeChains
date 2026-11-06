import axios from "axios";
import fs from "fs";
import path from "path";
import { Palm2AI } from "../../lib/palm2/palm2";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const promptsPath = path.join(__dirname, "prompts.jsonnet");
const jsonnetPrompts = JSON.parse(fs.readFileSync(promptsPath, "utf8"));

describe("Palm2AI Endpoint", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("generateText", () => {
        test("should generate text response from Google PaLM 2 text-bison-001 using Jsonnet prompt", async () => {
            const mockResponse = {
                candidates: [{ output: "Jsonnet enables declarative, composable prompt engineering." }],
            };
            mockedAxios.post = jest.fn().mockResolvedValueOnce({ data: mockResponse });
            const palm2 = new Palm2AI({ apiKey: "test_palm2_key" });
            const response = await palm2.generateText({ prompt: jsonnetPrompts.textPrompt, temperature: 0.2 });
            expect(response.candidates[0].output).toEqual("Jsonnet enables declarative, composable prompt engineering.");
        });
    });

    describe("chat (generateMessage)", () => {
        test("should generate multi-turn chat response from Google PaLM 2 chat-bison-001 using Jsonnet messages", async () => {
            const mockResponse = {
                candidates: [{ author: "1", content: "Yes, Palm2AI integrates seamlessly with EdgeChains Jsonnet files." }],
            };
            mockedAxios.post = jest.fn().mockResolvedValueOnce({ data: mockResponse });
            const palm2 = new Palm2AI({ apiKey: "test_palm2_key" });
            const response = await palm2.chat({ context: jsonnetPrompts.chatContext, messages: jsonnetPrompts.chatMessages });
            expect(response.candidates[0].content).toEqual("Yes, Palm2AI integrates seamlessly with EdgeChains Jsonnet files.");
        });
    });

    describe("generateEmbeddings (embedText)", () => {
        test("should generate vector embeddings from Google PaLM 2 embedding-gecko-001 using Jsonnet text", async () => {
            const mockResponse = {
                embedding: { value: [0.0124, -0.0412, 0.0891, 0.0032] },
            };
            mockedAxios.post = jest.fn().mockResolvedValueOnce({ data: mockResponse });
            const palm2 = new Palm2AI({ apiKey: "test_palm2_key" });
            const response = await palm2.generateEmbeddings({ text: jsonnetPrompts.embeddingText });
            expect(response.embedding.value).toEqual([0.0124, -0.0412, 0.0891, 0.0032]);
        });
    });
});
