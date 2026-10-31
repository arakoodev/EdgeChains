import { Palm2Client } from "../Palm2Client.js";

describe("Palm2Client Google PaLM2 API Support (#279)", () => {
    it("throws a clear error when API key is missing", async () => {
        const client = new Palm2Client({ apiKey: "" });
        await expect(client.generateText("Hi")).rejects.toThrow(/Missing Google PaLM2/);
    });

    it("validates non-empty prompts and messages", async () => {
        const client = new Palm2Client({ apiKey: "test-palm-key" });
        await expect(client.generateText("   ")).rejects.toThrow(/must be a non-empty/);
        await expect(client.chat({ messages: [] })).rejects.toThrow(/must not be empty/);
    });

    it("sends properly structured requests for generateText and embedText", async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = (async (url: string, init?: RequestInit) => {
                if (String(url).includes(":generateText")) {
                    const parsed = JSON.parse(String(init?.body || "{}"));
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({
                            candidates: [{ output: `Echo: ${parsed.prompt.text}` }],
                        }),
                    } as Response;
                }
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        embedding: { value: [0.12, -0.34, 0.56] },
                    }),
                } as Response;
            }) as typeof fetch;

            const client = new Palm2Client({ apiKey: "test-palm-key" });
            const out = await client.generateText("EdgeChains PaLM2");
            expect(out).toBe("Echo: EdgeChains PaLM2");

            const vec = await client.embedText("EdgeChains PaLM2");
            expect(vec).toEqual([0.12, -0.34, 0.56]);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
