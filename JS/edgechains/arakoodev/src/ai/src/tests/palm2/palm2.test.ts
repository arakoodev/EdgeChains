import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";
import { Palm2AI } from "../../lib/palm2/palm2.ts";
import { GeminiAI } from "../../lib/gemini/gemini.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Evaluates the Jsonnet prompt file (`prompts.jsonnet`) so that no prompts are hardcoded in the test file.
 */
function loadPromptsFromJsonnet(jsonnetPath: string): {
    system_context: string;
    text_prompt: string;
    chat_messages: Array<{ author: string; content: string }>;
    embedding_text: string;
} {
    const raw = fs.readFileSync(jsonnetPath, "utf8");
    const vars: Record<string, string> = {};
    const localRegex = /local\s+([a-zA-Z0-9_]+)\s*=\s*"([^"]*)";/g;
    let match: RegExpExecArray | null;
    while ((match = localRegex.exec(raw)) !== null) {
        vars[match[1]] = match[2];
    }

    const replaceMatch = raw.match(
        /std\.strReplace\(([a-zA-Z0-9_]+),\s*"([^"]+)",\s*"([^"]+)"\)/
    );
    const textPrompt = replaceMatch
        ? (vars[replaceMatch[1]] || "").replace(replaceMatch[2], replaceMatch[3])
        : "";

    return {
        system_context: vars.systemContext,
        text_prompt: textPrompt,
        chat_messages: [
            { author: "user", content: vars.chatUserTurn1 },
            { author: "assistant", content: vars.chatAssistantTurn1 },
            { author: "user", content: vars.chatUserTurn2 },
        ],
        embedding_text: vars.embeddingSample,
    };
}

describe("Google PaLM 2 & Gemini API Endpoints with Jsonnet Prompts (#279)", () => {
    const prompts = loadPromptsFromJsonnet(path.join(__dirname, "prompts.jsonnet"));
    let server: http.Server;
    let baseUrl = "";
    const recordedRequests: Array<{
        url: string;
        headers: http.IncomingHttpHeaders;
        body: any;
    }> = [];
    let failNextRequest = false;

    before(async () => {
        server = http.createServer((req, res) => {
            const chunks: Buffer[] = [];
            req.on("data", (c) => chunks.push(c));
            req.on("end", () => {
                const bodyText = Buffer.concat(chunks).toString("utf8");
                const parsedBody = bodyText ? JSON.parse(bodyText) : {};
                recordedRequests.push({
                    url: req.url || "",
                    headers: req.headers,
                    body: parsedBody,
                });

                if (failNextRequest) {
                    failNextRequest = false;
                    res.writeHead(503, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "Transient capacity error" }));
                    return;
                }

                res.writeHead(200, { "Content-Type": "application/json" });
                if (req.url?.includes(":generateText")) {
                    res.end(
                        JSON.stringify({
                            candidates: [
                                {
                                    output: `PaLM2 text response for: ${parsedBody.prompt?.text}`,
                                    safetyRatings: [
                                        {
                                            category: "HARM_CATEGORY_DEROGATORY",
                                            probability: "NEGLIGIBLE",
                                        },
                                    ],
                                },
                            ],
                        })
                    );
                } else if (req.url?.includes(":generateMessage")) {
                    const lastMsg =
                        parsedBody.prompt?.messages?.[parsedBody.prompt.messages.length - 1]
                            ?.content || "";
                    res.end(
                        JSON.stringify({
                            candidates: [
                                {
                                    author: "1",
                                    content: `PaLM2 chat reply to: ${lastMsg}`,
                                },
                            ],
                            messages: parsedBody.prompt?.messages || [],
                        })
                    );
                } else if (req.url?.includes(":embedText")) {
                    res.end(
                        JSON.stringify({
                            embedding: {
                                value: [0.125, -0.45, 0.875, 0.01],
                            },
                        })
                    );
                } else if (req.url?.includes(":generateContent")) {
                    const userPart =
                        parsedBody.contents?.[parsedBody.contents.length - 1]?.parts?.[0]
                            ?.text || "";
                    res.end(
                        JSON.stringify({
                            candidates: [
                                {
                                    content: {
                                        role: "model",
                                        parts: [{ text: `Gemini response for: ${userPart}` }],
                                    },
                                    finishReason: "STOP",
                                    index: 0,
                                    safetyRatings: [],
                                },
                            ],
                            usageMetadata: {
                                promptTokenCount: 12,
                                candidatesTokenCount: 8,
                                totalTokenCount: 20,
                            },
                        })
                    );
                } else {
                    res.end(JSON.stringify({ ok: true }));
                }
            });
        });

        await new Promise<void>((resolve) => {
            server.listen(0, "127.0.0.1", () => {
                const addr = server.address();
                if (addr && typeof addr === "object") {
                    baseUrl = `http://127.0.0.1:${addr.port}/v1beta2`;
                }
                resolve();
            });
        });
    });

    after(async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    test("loads prompts from prompts.jsonnet and calls text-bison-001:generateText against live HTTP server", async () => {
        const palm = new Palm2AI({
            apiKey: "test-palm2-api-key",
            baseUrl,
        });

        const res = await palm.generateText({
            prompt: prompts.text_prompt,
            model: "text-bison-001",
            temperature: 0.3,
            maxOutputTokens: 256,
            topP: 0.9,
            topK: 40,
        });

        assert.equal(
            res.output,
            `PaLM2 text response for: ${prompts.text_prompt}`
        );
        const lastReq = recordedRequests[recordedRequests.length - 1];
        assert.equal(lastReq.url, "/v1beta2/models/text-bison-001:generateText");
        assert.equal(lastReq.headers["x-goog-api-key"], "test-palm2-api-key");
        assert.equal(lastReq.body.prompt.text, prompts.text_prompt);
        assert.equal(lastReq.body.temperature, 0.3);
        assert.equal(lastReq.body.maxOutputTokens, 256);
    });

    test("calls chat-bison-001:generateMessage with multi-turn Jsonnet messages and context", async () => {
        const palm = new Palm2AI({
            apiKey: "test-palm2-api-key",
            baseUrl,
        });

        const chatRes = await palm.chat({
            context: prompts.system_context,
            messages: prompts.chat_messages,
            temperature: 0.5,
        });

        const expectedLastTurn =
            prompts.chat_messages[prompts.chat_messages.length - 1].content;
        assert.equal(chatRes.content, `PaLM2 chat reply to: ${expectedLastTurn}`);

        const lastReq = recordedRequests[recordedRequests.length - 1];
        assert.equal(lastReq.url, "/v1beta2/models/chat-bison-001:generateMessage");
        assert.equal(lastReq.body.prompt.context, prompts.system_context);
        assert.equal(lastReq.body.prompt.messages.length, 3);
    });

    test("calls embedding-gecko-001:embedText and returns numeric vector", async () => {
        const palm = new Palm2AI({
            apiKey: "test-palm2-api-key",
            baseUrl,
        });

        const emb = await palm.embedText({
            text: prompts.embedding_text,
        });

        assert.deepEqual(emb.embedding.value, [0.125, -0.45, 0.875, 0.01]);
        const lastReq = recordedRequests[recordedRequests.length - 1];
        assert.equal(lastReq.url, "/v1beta2/models/embedding-gecko-001:embedText");
        assert.equal(lastReq.body.text, prompts.embedding_text);
    });

    test("supports Gemini models via generateContent and retries transient 503 errors", async () => {
        const gemini = new GeminiAI({
            apiKey: "test-gemini-key",
            baseUrl: `${baseUrl}/models`,
        });

        failNextRequest = true;
        const response = await gemini.chat({
            model: "gemini-1.5-flash",
            prompt: prompts.text_prompt,
            temperature: 0.2,
            max_output_tokens: 512,
            responseType: "application/json",
            delay: 10,
        });

        assert.equal(
            response.candidates[0].content.parts[0].text,
            `Gemini response for: ${prompts.text_prompt}`
        );
        const lastReq = recordedRequests[recordedRequests.length - 1];
        assert.equal(lastReq.url, "/v1beta2/models/gemini-1.5-flash:generateContent");
        assert.deepEqual(lastReq.body.generationConfig, {
            temperature: 0.2,
            maxOutputTokens: 512,
            responseMimeType: "application/json",
        });
    });
});
