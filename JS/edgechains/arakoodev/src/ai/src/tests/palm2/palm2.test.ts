import { afterEach, describe, expect, it } from "vitest";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { GeminiAI } from "../../lib/gemini/gemini.js";
import { Palm2AI } from "../../lib/palm2/palm2.js";

type CapturedRequest = {
    method?: string;
    url?: string;
    headers: IncomingMessage["headers"];
    body: unknown;
};

async function createJsonServer(
    responseBody: unknown
): Promise<{ baseUrl: string; requests: CapturedRequest[]; close: () => Promise<void> }> {
    const requests: CapturedRequest[] = [];

    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
        const chunks: Buffer[] = [];

        req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        req.on("end", () => {
            const rawBody = Buffer.concat(chunks).toString("utf8");
            requests.push({
                method: req.method,
                url: req.url,
                headers: req.headers,
                body: rawBody ? JSON.parse(rawBody) : undefined,
            });

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(responseBody));
        });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));

    const address = server.address() as AddressInfo;

    return {
        baseUrl: `http://127.0.0.1:${address.port}`,
        requests,
        close: () =>
            new Promise<void>((resolve, reject) =>
                server.close((error) => (error ? reject(error) : resolve()))
            ),
    };
}

describe("Palm2AI", () => {
    afterEach(() => {
        delete process.env.GOOGLE_API_KEY;
        delete process.env.GEMINI_API_KEY;
        delete process.env.PALM2_API_KEY;
    });

    it("sends generateContent requests with generationConfig", async () => {
        const server = await createJsonServer({
            candidates: [{ content: { parts: [{ text: "Hello from Gemini" }] } }],
        });

        try {
            const client = new Palm2AI({ apiKey: "test-key", baseUrl: server.baseUrl });
            const response = await client.chat({
                prompt: "Say hello",
                temperature: 0.2,
                maxOutputTokens: 64,
                responseMimeType: "application/json",
            });

            expect(response.candidates[0].content?.parts[0].text).toBe("Hello from Gemini");
            expect(server.requests).toHaveLength(1);
            expect(server.requests[0].url).toBe("/models/gemini-pro:generateContent");
            expect(server.requests[0].headers["x-goog-api-key"]).toBe("test-key");
            expect(server.requests[0].body).toEqual({
                contents: [{ role: "user", parts: [{ text: "Say hello" }] }],
                generationConfig: {
                    temperature: 0.2,
                    maxOutputTokens: 64,
                    responseMimeType: "application/json",
                },
            });
        } finally {
            await server.close();
        }
    });

    it("sends legacy generateText requests for palm/text-bison models", async () => {
        const server = await createJsonServer({
            candidates: [{ output: "Legacy response" }],
        });

        try {
            const client = new Palm2AI({ apiKey: "test-key", baseUrl: server.baseUrl });
            const response = await client.generateText({
                prompt: "Explain EdgeChains",
                temperature: 0.5,
                topK: 10,
            });

            expect(response.candidates[0].output).toBe("Legacy response");
            expect(server.requests).toHaveLength(1);
            expect(server.requests[0].url).toBe("/models/text-bison-001:generateText");
            expect(server.requests[0].body).toEqual({
                prompt: { text: "Explain EdgeChains" },
                temperature: 0.5,
                topK: 10,
            });
        } finally {
            await server.close();
        }
    });

    it("sends embedText requests for embedding models", async () => {
        const server = await createJsonServer({
            embedding: {
                values: [0.1, 0.2, 0.3],
            },
        });

        try {
            const client = new Palm2AI({ apiKey: "test-key", baseUrl: server.baseUrl });
            const response = await client.generateEmbedding({
                text: "Embed EdgeChains",
            });

            expect(response.embedding.values).toEqual([0.1, 0.2, 0.3]);
            expect(server.requests).toHaveLength(1);
            expect(server.requests[0].url).toBe("/models/embedding-gecko-001:embedText");
            expect(server.requests[0].body).toEqual({
                text: "Embed EdgeChains",
            });
        } finally {
            await server.close();
        }
    });

    it("maps GeminiAI snake_case options onto the Google request body", async () => {
        const server = await createJsonServer({
            candidates: [{ content: { parts: [{ text: "Structured output" }] } }],
        });

        try {
            const gemini = new GeminiAI({ apiKey: "test-key", baseUrl: server.baseUrl });
            const response = await gemini.chat({
                model: "gemini-1.5-pro",
                prompt: "Return JSON",
                max_output_tokens: 32,
                responseType: "application/json",
                temperature: 0.7,
                max_retry: 1,
            });

            expect(response.candidates[0].content?.parts[0].text).toBe("Structured output");
            expect(server.requests).toHaveLength(1);
            expect(server.requests[0].url).toBe("/models/gemini-1.5-pro:generateContent");
            expect(server.requests[0].body).toEqual({
                contents: [{ role: "user", parts: [{ text: "Return JSON" }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 32,
                    responseMimeType: "application/json",
                },
            });
        } finally {
            await server.close();
        }
    });
});
