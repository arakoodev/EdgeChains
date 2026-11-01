import http from "http";

/**
 * Mock Gemini API server for testing.
 */
export function createGeminiMockServer(options?: {
    port?: number;
    response?: string;
    failCount?: number;
    latencyMs?: number;
}): { server: http.Server; start: () => Promise<string>; stop: () => Promise<void> } {
    const {
        response = "Mock Gemini response",
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
            res.end(JSON.stringify({ error: { message: "Mock Gemini error" } }));
            return;
        }

        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
            const isStream = (req.url || "").includes("streamGenerateContent");

            if (isStream) {
                res.writeHead(200, {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-cache",
                });

                const words = response.split(" ");
                for (const word of words) {
                    const chunk = {
                        candidates: [{ content: { parts: [{ text: word + " " }] } }],
                    };
                    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                }
                res.end();
            } else {
                const responseBody = {
                    candidates: [
                        {
                            content: { parts: [{ text: response }], role: "model" },
                            finishReason: "STOP",
                        },
                    ],
                    usageMetadata: {
                        promptTokenCount: 8,
                        candidatesTokenCount: 15,
                        totalTokenCount: 23,
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
                    resolve(`http://127.0.0.1:${addr.port}`);
                });
            }),
        stop: () =>
            new Promise<void>((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()));
            }),
    };
}
