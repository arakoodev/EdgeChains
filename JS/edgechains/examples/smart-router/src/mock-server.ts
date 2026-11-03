import http from "http";
import type { AddressInfo } from "net";

/**
 * Tiny offline mock of the OpenAI chat, PaLM generateText and Cohere generate
 * APIs so the example runs end-to-end without real API keys. The first call to
 * 'gpt-3.5-turbo' answers 429 + Retry-After to demonstrate cooldown failover.
 */
export class ExampleMockServer {
    private gpt35FirstHit = false;
    private server = http.createServer((req, res) => {
        let raw = "";
        req.on("data", (c) => (raw += c));
        req.on("end", () => {
            const path = req.url || "";
            const body = JSON.parse(raw || "{}");
            // PaLM carries the model in the path (:generateText), not in the body
            const model = String(body.model ?? path.match(/\/models\/([^:]+):/)?.[1] ?? "");
            const echo = String(
                body.messages?.[body.messages.length - 1]?.content ?? body.prompt ?? body.prompts?.[0] ?? ""
            ).slice(0, 60);
            const json = (status: number, obj: unknown, headers = {}) => {
                res.writeHead(status, { "content-type": "application/json", ...headers });
                res.end(typeof obj === "string" ? obj : JSON.stringify(obj));
            };

            if (path.endsWith("/v1/chat/completions")) {
                if (body.model === "gpt-3.5-turbo" && !this.gpt35FirstHit) {
                    this.gpt35FirstHit = true;
                    return json(429, { error: { message: "mock rate limit exceeded" } }, { "Retry-After": "1" });
                }
                if (body.stream) {
                    res.writeHead(200, { "content-type": "text/event-stream" });
                    for (const piece of ["streaming ", "from ", model]) {
                        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`);
                    }
                    res.end("data: [DONE]\n\n");
                    return;
                }
                return json(200, {
                    choices: [{ message: { role: "assistant", content: `mock ${model} reply to: "${echo}"` } }],
                    usage: { prompt_tokens: 8, completion_tokens: 12, total_tokens: 20 },
                });
            }
            if (path.includes(":generateText")) {
                return json(200, {
                    candidates: [{ output: `mock ${model} reply to: "${echo}"` }],
                    tokensInfo: {
                        inputCountsPerAuthor: [{ author: "user", count: 8 }],
                        outputCountsPerAuthor: [{ author: "model", count: 12 }],
                    },
                });
            }
            if (path.endsWith("/v1/generate")) {
                if (body.stream) {
                    res.writeHead(200, { "content-type": "application/json" });
                    res.end(`{"text":"streaming "}\n{"text":"from "}\n{"text":"${model}"}\n`);
                    return;
                }
                return json(200, {
                    completions: [{ text: `mock ${model} reply to: "${echo}"` }],
                    meta: { billed_units: { input_tokens: 8, output_tokens: 12 } },
                });
            }
            return json(404, { error: "not found" });
        });
    });

    start(): Promise<string> {
        return new Promise((resolve) => {
            this.server.listen(0, "127.0.0.1", () => {
                const addr = this.server.address() as AddressInfo;
                resolve(`http://127.0.0.1:${addr.port}`);
            });
        });
    }

    close(): void {
        (this.server as any).closeAllConnections?.();
        this.server.close();
    }
}
