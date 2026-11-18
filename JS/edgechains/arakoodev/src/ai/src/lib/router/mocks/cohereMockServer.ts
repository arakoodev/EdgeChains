import http from "http";

/**
 * Mock Cohere API server for testing.
 */
export function createCohereMockServer(options?: {
    port?: number;
    response?: string;
    failCount?: number;
    latencyMs?: number;
}): { server: http.Server; start: () => Promise<string>; stop: () => Promise<void> } {
    const {
        response = "Mock Cohere response",
        failCount = 0,
        latencyMs = 10,
    } = options || {};

    let requestCount = 0;
    let port = options?.port || 0;

    const server = http.createServer(async (req, res) => {
        requestCount++;

        if (latencyMs > 0) {
            await new Promise((r) => setTimeout(r, latencyMs));
        }

        if (requestCount <= failCount) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "Mock Cohere error" }));
            return;
        }

        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
            const isStream = body.includes('"stream":true') || body.includes('"stream": true');

            if (isStream) {
                res.writeHead(200, {
                    "Content-Type": "application/json",
                    "Transfer-Encoding": "chunked",
                });

                const words = response.split(" ");
                for (const word of words) {
                    res.write(
                        JSON.stringify({ event_type: "text-generation", text: word + " " }) + "\n",
                    );
                }
                res.write(JSON.stringify({ event_type: "stream-end" }) + "\n");
                res.end();
            } else {
                const responseBody = {
                    text: response,
                    meta: {
                        tokens: {
                            input_tokens: 12,
                            output_tokens: 18,
                        },
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
