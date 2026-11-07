import http from "http";
import path from "path";
import Jsonnet from "@arakoodev/jsonnet";
import { Palm2AI } from "../../lib/palm2/palm2";

describe("Palm2AI HTTP & Jsonnet Integration", () => {
    let server: http.Server;
    let baseUrl = "";
    let lastRequestPath = "";
    let lastApiKeyHeader = "";
    let lastRequestBody: Record<string, unknown> = {};

    beforeAll(async () => {
        server = http.createServer((req, res) => {
            lastRequestPath = req.url || "";
            lastApiKeyHeader = String(req.headers["x-goog-api-key"] || "");
            const chunks: Buffer[] = [];
            req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
            req.on("end", () => {
                const raw = Buffer.concat(chunks).toString("utf-8");
                lastRequestBody = raw ? JSON.parse(raw) : {};
                res.writeHead(200, { "Content-Type": "application/json" });
                if (lastRequestPath.endsWith(":generateText")) {
                    res.end(
                        JSON.stringify({
                            candidates: [{ output: "PaLM2 server response" }],
                        })
                    );
                    return;
                }
                if (lastRequestPath.endsWith(":embedContent")) {
                    res.end(
                        JSON.stringify({
                            embedding: { values: [0.12, 0.34, 0.56] },
                        })
                    );
                    return;
                }
                res.end(
                    JSON.stringify({
                        candidates: [
                            {
                                content: {
                                    role: "model",
                                    parts: [{ text: "Gemini/PaLM2 chat response" }],
                                },
                                finishReason: "STOP",
                                index: 0,
                            },
                        ],
                    })
                );
            });
        });

        await new Promise<void>((resolve) => {
            server.listen(0, "127.0.0.1", () => {
                const addr = server.address();
                if (addr && typeof addr === "object") {
                    baseUrl = `http://127.0.0.1:${addr.port}/v1beta`;
                }
                resolve();
            });
        });
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    test("evaluates prompt from testcases/palm2/basic.jsonnet and posts to generateText HTTP endpoint", async () => {
        const jsonnet = new Jsonnet();
        jsonnet.extString("topic", "EdgeChains declarative prompt routing");
        const jsonnetPath = path.resolve(__dirname, "../../testcases/palm2/basic.jsonnet");
        const evaluated = JSON.parse(jsonnet.evaluateFile(jsonnetPath));

        const client = new Palm2AI({ apiKey: "test-palm2-key", baseUrl });
        const result = await client.generateText({
            model: evaluated.model,
            prompt: evaluated.prompt,
            temperature: evaluated.temperature,
            maxOutputTokens: evaluated.maxOutputTokens,
            maxRetries: 1,
        });

        expect(result.candidates[0].output).toBe("PaLM2 server response");
        expect(lastRequestPath).toBe("/v1beta/models/text-bison-001:generateText");
        expect(lastApiKeyHeader).toBe("test-palm2-key");
        expect(lastRequestBody).toMatchObject({
            prompt: { text: "Explain EdgeChains declarative prompt routing in one concise sentence." },
            temperature: 0.2,
            maxOutputTokens: 256,
        });
    });

    test("sends chat prompt to generateContent endpoint and returns structured candidates", async () => {
        const client = new Palm2AI({ apiKey: "test-palm2-key", baseUrl });
        const result = await client.chat({
            model: "gemini-pro",
            prompt: "Verify chat endpoint",
            temperature: 0.4,
            maxRetries: 1,
        });

        expect(result.candidates[0].content?.parts[0].text).toBe("Gemini/PaLM2 chat response");
        expect(lastRequestPath).toBe("/v1beta/models/gemini-pro:generateContent");
        expect(lastApiKeyHeader).toBe("test-palm2-key");
    });

    test("generates vector embeddings via embedContent endpoint", async () => {
        const client = new Palm2AI({ apiKey: "test-palm2-key", baseUrl });
        const embeddingRes = await client.generateEmbeddings({
            model: "embedding-001",
            text: "EdgeChains vector embedding test",
            maxRetries: 1,
        });

        expect(embeddingRes.embedding.values).toEqual([0.12, 0.34, 0.56]);
        expect(lastRequestPath).toBe("/v1beta/models/embedding-001:embedContent");
    });
});
