import http from "http";
import type { AddressInfo } from "net";

export interface RecordedRequest {
    method: string;
    url: string;
    headers: http.IncomingHttpHeaders;
    body: any;
    apiKey?: string;
}

export type RouteHandler = (req: RecordedRequest, res: http.ServerResponse) => void | Promise<void>;

interface Route {
    method: string;
    match: RegExp;
    handler: RouteHandler;
}

export interface MockLLMServer {
    baseUrl: string;
    requests: RecordedRequest[];
    /** Number of requests whose Authorization header matched `apiKey`. */
    hitsFor(apiKey: string): number;
    hitsWhere(pred: (req: RecordedRequest) => boolean): number;
    route(method: string, match: RegExp | string, handler: RouteHandler): void;
    clearRoutes(): void;
    close(): Promise<void>;
}

function readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        req.on("error", reject);
    });
}

export function json(res: http.ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
}

export function sse(res: http.ServerResponse, lines: string[]): void {
    res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
    });
    for (const line of lines) res.write(`data: ${line}\n\n`);
    res.end();
}

export function ndjson(res: http.ServerResponse, objects: unknown[]): void {
    res.writeHead(200, { "content-type": "application/json" });
    for (const obj of objects) res.write(JSON.stringify(obj) + "\n");
    res.end();
}

function bearer(req: http.IncomingMessage): string | undefined {
    const auth = req.headers.authorization;
    return auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
}

/** Canned happy-path responses for openai / palm / cohere endpoints. */
function defaultHandler(req: RecordedRequest, res: http.ServerResponse): void {
    const url = (req.url || "").split("?")[0];

    // --- logging endpoints -------------------------------------------------
    if (/\/api\/\d+\/envelope\/?$/.test(url)) return json(res, 200, { id: "event-id" });
    if (url === "/capture/" || url === "/batch/") return json(res, 200, { status: 1 });

    // --- openai ------------------------------------------------------------
    if (url === "/v1/chat/completions") {
        if (req.body?.stream) {
            return sse(res, [
                JSON.stringify({
                    id: "chatcmpl-mock",
                    choices: [
                        {
                            index: 0,
                            delta: { role: "assistant", content: "openai" },
                            finish_reason: null,
                        },
                    ],
                }),
                JSON.stringify({
                    id: "chatcmpl-mock",
                    choices: [{ index: 0, delta: { content: " says hi" }, finish_reason: null }],
                }),
                JSON.stringify({
                    id: "chatcmpl-mock",
                    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
                    usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 },
                }),
                "[DONE]",
            ]);
        }
        return json(res, 200, {
            id: "chatcmpl-mock",
            choices: [
                {
                    index: 0,
                    message: { role: "assistant", content: "openai says hi" },
                    finish_reason: "stop",
                },
            ],
            usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 },
        });
    }

    // --- google palm --------------------------------------------------------
    if (/^\/v1beta2\/models\/[^:]+:generateMessage$/.test(url)) {
        return json(res, 200, {
            candidates: [{ author: "1", content: "palm says hi" }],
            messages: [{ author: "1", content: "palm says hi" }],
            usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 6, totalTokenCount: 10 },
        });
    }

    // --- cohere -------------------------------------------------------------
    if (url === "/v1/chat") {
        if (req.body?.stream) {
            return ndjson(res, [
                { event_type: "stream-start" },
                { event_type: "text-generation", text: "cohere" },
                { event_type: "text-generation", text: " says hi" },
                {
                    event_type: "stream-end",
                    finish_reason: "COMPLETE",
                    response: {
                        token_count: { prompt_tokens: 3, response_tokens: 4, total_tokens: 7 },
                    },
                },
            ]);
        }
        return json(res, 200, {
            response_id: "cohere-mock",
            text: "cohere says hi",
            finish_reason: "COMPLETE",
            token_count: { prompt_tokens: 3, response_tokens: 4, total_tokens: 7 },
        });
    }

    json(res, 404, { error: `no mock route for ${req.method} ${url}` });
}

export async function createMockLLMServer(): Promise<MockLLMServer> {
    const routes: Route[] = [];
    const requests: RecordedRequest[] = [];

    const server = http.createServer(async (req, res) => {
        const raw = await readBody(req);
        let body: any = undefined;
        try {
            body = raw ? JSON.parse(raw) : undefined;
        } catch {
            body = raw;
        }
        const record: RecordedRequest = {
            method: req.method || "GET",
            url: req.url || "",
            headers: req.headers,
            body,
            apiKey: bearer(req),
        };
        requests.push(record);
        const route = routes.find((r) => r.method === record.method && r.match.test(record.url));
        try {
            await (route ? route.handler : defaultHandler)(record, res);
        } catch (error) {
            if (!res.headersSent) json(res, 500, { error: String(error) });
            else res.end();
        }
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;

    return {
        baseUrl: `http://127.0.0.1:${port}`,
        requests,
        hitsFor(apiKey: string) {
            return requests.filter((r) => r.apiKey === apiKey).length;
        },
        hitsWhere(pred) {
            return requests.filter(pred).length;
        },
        route(method, match, handler) {
            routes.push({
                method,
                match: typeof match === "string" ? new RegExp(`^${match}$`) : match,
                handler,
            });
        },
        clearRoutes() {
            routes.length = 0;
        },
        close() {
            return new Promise((resolve, reject) =>
                server.close((err) => (err ? reject(err) : resolve()))
            );
        },
    };
}
