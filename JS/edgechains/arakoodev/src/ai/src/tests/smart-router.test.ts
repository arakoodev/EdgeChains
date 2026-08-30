import { SmartRouter } from "../lib/smart-router/smartRouter.js";

describe("SmartRouter", () => {
    describe("detectProvider", () => {
        const router = new SmartRouter();

        it("should detect OpenAI models", () => {
            expect(router.detectProvider("gpt-4o")).toBe("openai");
            expect(router.detectProvider("gpt-4-turbo")).toBe("openai");
            expect(router.detectProvider("gpt-3.5-turbo")).toBe("openai");
            expect(router.detectProvider("o1-preview")).toBe("openai");
            expect(router.detectProvider("o3-mini")).toBe("openai");
        });

        it("should detect Gemini models", () => {
            expect(router.detectProvider("gemini-pro")).toBe("gemini");
            expect(router.detectProvider("gemini-1.5-pro")).toBe("gemini");
            expect(router.detectProvider("gemini-2.0-flash")).toBe("gemini");
        });

        it("should detect Llama models", () => {
            expect(router.detectProvider("llama-3-70b")).toBe("llama");
            expect(router.detectProvider("meta-llama/Llama-3-8B")).toBe("llama");
            expect(router.detectProvider("mixtral-8x7b")).toBe("llama");
            expect(router.detectProvider("qwen-72b")).toBe("llama");
            expect(router.detectProvider("deepseek-coder")).toBe("llama");
        });

        it("should return null for unknown models", () => {
            expect(router.detectProvider("unknown-model")).toBeNull();
            expect(router.detectProvider("")).toBeNull();
        });
    });

    describe("listProviders", () => {
        it("should list all providers with availability", () => {
            const router = new SmartRouter();
            const providers = router.listProviders();
            expect(providers.length).toBeGreaterThan(0);
            expect(providers[0]).toHaveProperty("name");
            expect(providers[0]).toHaveProperty("available");
        });
    });

    describe("isModelSupported", () => {
        it("should return true for known model patterns", () => {
            const router = new SmartRouter();
            // Even without API keys, pattern detection works
            expect(router.isModelSupported("gpt-4o")).toBe(true);
            expect(router.isModelSupported("gemini-pro")).toBe(true);
        });
    });

    describe("custom providers", () => {
        it("should support custom provider configs", () => {
            const router = new SmartRouter({
                providers: [
                    {
                        name: "custom",
                        patterns: [/^custom-/i],
                        factory: () => ({
                            chat: async (opts) => ({ content: "custom response" }),
                        }),
                    },
                ],
            });

            expect(router.detectProvider("custom-model")).toBe("custom");
        });
    });
});
