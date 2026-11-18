import http from "http";
import type { AddressInfo } from "net";

export interface RecordedRequest {
    path: string;
    body: any;
}

interface FailureRule {
    status: number;
    /** Retry-After header value in seconds (used with 429). */
    retryAfter?: number;
}

/**
 * Offline mock of the OpenAI (/v1/chat/completions, /v1/completions),
 * PaLM (:generateText) and Cohere (/v1/generate) HTTP APIs.
 * Deterministic usage numbers: models containing "heavy" report 40/10, other
 * OpenAI models report 10/5, PaLM reports 4/3, Cohere reports 4/2 tokens.
 */
export class MockAiServer {
    readonly requests: RecordedRequest[] = [];
    baseUrl = "";

    private failureQueues: Record<string, FailureRule[]> = {};
    private server = http.createServer((req, res) => this.handle(req, res));

    start(): Promise<string> {
        return new Promise((resolve) => {
            this.server.listen(0, "127.0.0.1", () => {
                const addr = this.server.address() as AddressInfo;
                this.baseUrl = `http://127.0.0.1:${addr.port}`;
                resolve(this.baseUrl);
            });
        });
    }

    close(): Promise<void> {
        (this.server as any).closeAllConnections?.();
        return new Promise((resolve) => this.server.close(() => resolve()));
    }

    /** Serve one failing response per queued rule for paths/models matching `match`. */
    failNext(match: string, rule: FailureRule): void {
        (this.failureQueues[match] ||= []).push(rule);
    }

    reset(): void {
        this.requests.length = 0;
        this.failureQueues = {};
    }

    private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
        let raw = "";
        req.on("data", (chunk) => (raw += chunk));
        req.on("end", () => {
            const path = req.url || "";
            const body = raw ? JSON.parse(raw) : {};
            this.requests.push({ path, body });

            const modelFromPath = path.match(/\/models\/([^:]+):/)?.[1];
            const model = String(body.model ?? modelFromPath ?? "");
            for (const [match, queue] of Object.entries(this.failureQueues)) {
                if (queue.length && (path.includes(match) || model.includes(match))) {
                    const rule = queue.shift()!;
                    const headers: http.OutgoingHttpHeaders = {
                        "content-type": "application/json",
                    };
                    if (rule.retryAfter !== undefined) headers["Retry-After"] = String(rule.retryAfter);
                    res.writeHead(rule.status, headers);
                    res.end(JSON.stringify({ error: { message: `mock ${rule.status}` } }));
                    return;
                }
            }

            const echo = String(
                body.messages?.[body.messages.length - 1]?.content ??
                    body.prompt ??
                    body.prompts?.[0] ??
                    ""
            ).slice(0, 60);

            if (path.endsWith("/v1/chat/completions")) {
                if (body.stream) this.openaiStream(res, model);
                else this.json(res, openaiChatBody(model, echo));
            } else if (path.endsWith("/v1/completions")) {
                this.json(res, {
                    choices: [{ text: `openai-done(${model}): ${echo}` }],
                    usage: openaiUsage(model, 5, 2),
                });
            } else if (path.includes(":generateText")) {
                this.json(res, {
                    candidates: [{ index: 0, output: `palm(${model}): ${echo}` }],
                    tokensInfo: {
                        inputCountsPerAuthor: [{ author: "user", count: 4 }],
                        outputCountsPerAuthor: [{ author: "model", count: 3 }],
                    },
                });
            } else if (path.endsWith("/v1/generate")) {
                if (body.stream) this.cohereStream(res);
                else
                    this.json(res, {
                        id: "mock-cohere",
                        completions: [{ index: 0, text: `cohere(${model}): ${echo}` }],
                        meta: { billed_units: { input_tokens: 4, output_tokens: 2 } },
                    });
            } else {
                this.json(res, { error: "not found" }, 404);
            }
        });
    }

    private openaiStream(res: http.ServerResponse, model: string): void {
        res.writeHead(200, { "content-type": "text/event-stream" });
        const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
        send({ choices: [{ delta: { content: "stream-hello " } }] });
        send({ choices: [{ delta: { content: `${model}` } }] });
        send({ choices: [], usage: openaiUsage(model, 10, 3) });
        res.write("data: [DONE]\n\n");
        res.end();
    }

    private cohereStream(res: http.ServerResponse): void {
        res.writeHead(200, { "content-type": "application/json" });
        res.write('{"text":"stream-"}\n{"text":"cohere"}\n');
        res.end();
    }

    private json(res: http.ServerResponse, obj: unknown, status = 200): void {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(obj));
    }
}

function openaiUsage(model: string, promptTokens: number, completionTokens: number) {
    const [p, c] = model.includes("heavy") ? [40, 10] : [promptTokens, completionTokens];
    return { prompt_tokens: p, completion_tokens: c, total_tokens: p + c };
}

function openaiChatBody(model: string, echo: string) {
    return {
        id: "chatcmpl-mock",
        choices: [{ index: 0, message: { role: "assistant", content: `openai(${model}): ${echo}` } }],
        usage: openaiUsage(model, 10, 5),
    };
}
