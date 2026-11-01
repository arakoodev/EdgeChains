import http from "http";

/**
 * Mock OpenAI-compatible server for testing.
 * Responds to POST /v1/chat/completions with a canned response.
 */
export function createOpenAIMockServer(options?: {
    port?: number;
    response?: string;
    failCount?: number;
    latencyMs?: number;
}): { server: http.Server; start: () => Promise<string>; stop: () => Promise<void> } {
    const {
        response = "Mock OpenAI response",
        failCount = 0,
        latencyMs = 10,
    } = options || {};

    let requestCount = 0;
    let port = options?.port || 0;

    const server = http.createServer(async (req, res) => {
        requestCount++;

        // Simulate latency
        if (latencyMs > 0) {
            await new Promise((r) => setTimeout(r, latencyMs));
        }

        // Simulate failures for the first N requests
        if (requestCount <= failCount) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: { message: "Mock server error" } }));
            return;
        }

        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
            const isStream = body.includes('"stream":true') || body.includes('"stream": true');

            if (isStream) {
                res.writeHead(200, {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                    Connection: "keep-alive",
                });

                const words = response.split(" ");
                for (const word of words) {
                    const chunk = {
                        choices: [{ delta: { content: word + " " } }],
                    };
                    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                }
                res.write("data: [DONE]\n\n");
                res.end();
            } else {
                const responseBody = {
                    choices: [
                        {
                            message: { role: "assistant", content: response },
                            finish_reason: "stop",
                        },
                    ],
                    usage: {
                        prompt_tokens: 10,
                        completion_tokens: 20,
                        total_tokens: 30,
                    },
                };

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify(responseBody));
            }
        });
    });

    return {
        server,
        start: () =>
            new Promise<string>((resolve) => {
                server.listen(port, "127.0.0.1", () => {
                    const addr = server.address() as any;
                    resolve(`http://127.0.0.1:${addr.port}/v1`);
                });
            }),
        stop: () =>
            new Promise<void>((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()));
            }),
    };
}
