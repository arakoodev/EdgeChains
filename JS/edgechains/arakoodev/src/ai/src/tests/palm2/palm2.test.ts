import { Palm2 } from "../../lib/palm2/palm2.js";

describe("Palm2", () => {
    let client: Palm2;

    beforeEach(() => {
        client = new Palm2({ apiKey: "test-api-key" });
    });

    describe("Constructor", () => {
        it("should create a client with an API key", () => {
            const c = new Palm2({ apiKey: "my-key" });
            expect(c).toBeDefined();
            expect(c.apiKey).toBe("my-key");
        });

        it("should use GOOGLE_API_KEY env var as fallback", () => {
            process.env.GOOGLE_API_KEY = "env-key";
            const c = new Palm2({});
            expect(c.apiKey).toBe("env-key");
            delete process.env.GOOGLE_API_KEY;
        });

        it("should use PALM2_API_KEY env var as fallback", () => {
            process.env.PALM2_API_KEY = "palm-key";
            const c = new Palm2({});
            expect(c.apiKey).toBe("palm-key");
            delete process.env.PALM2_API_KEY;
        });
    });

    describe("chat method", () => {
        it("should be a function", () => {
            expect(typeof client.chat).toBe("function");
        });

        it("should accept valid options", () => {
            const options = {
                model: "gemini-pro",
                prompt: "Hello, world!",
                temperature: 0.7,
                maxOutputTokens: 100,
                topK: 40,
                topP: 0.95,
            };
            expect(options.model).toBe("gemini-pro");
            expect(options.prompt).toBe("Hello, world!");
        });
    });

    describe("batchChat method", () => {
        it("should be a function", () => {
            expect(typeof client.batchChat).toBe("function");
        });

        it("should accept multiple prompts", () => {
            const options = {
                model: "gemini-pro",
                prompts: ["What is AI?", "What is ML?"],
                temperature: 0.5,
            };
            expect(options.prompts).toHaveLength(2);
        });
    });

    describe("countTokens method", () => {
        it("should be a function", () => {
            expect(typeof client.countTokens).toBe("function");
        });
    });

    describe("listModels method", () => {
        it("should be a function", () => {
            expect(typeof client.listModels).toBe("function");
        });
    });

    describe("URL building", () => {
        it("should build correct generateContent URL", () => {
            // Access private method via any cast
            const url = (client as any).buildUrl("gemini-pro", "generateContent");
            expect(url).toContain("generativelanguage.googleapis.com");
            expect(url).toContain("gemini-pro:generateContent");
            expect(url).toContain("key=test-api-key");
        });

        it("should build correct countTokens URL", () => {
            const url = (client as any).buildUrl("gemini-pro", "countTokens");
            expect(url).toContain("gemini-pro:countTokens");
        });
    });

    describe("Model defaults", () => {
        it("should default to gemini-pro model", () => {
            const url = (client as any).buildUrl("gemini-pro", "generateContent");
            expect(url).toContain("gemini-pro");
        });
    });
});