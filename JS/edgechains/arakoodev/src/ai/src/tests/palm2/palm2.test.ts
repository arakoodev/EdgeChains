import { createServer, Server } from "http";
import { AddressInfo } from "net";
import { Palm2AI } from "../../lib/palm2/palm2";

type CapturedRequest = {
    method?: string;
    url?: string;
    body: any;
};

describe("Palm2AI", () => {
    let server: Server;
    let baseUrl: string;
    let capturedRequest: CapturedRequest | undefined;
    const mockResponse = {
        candidates: [
            {
                output: "Test response",
            },
        ],
    };

    beforeEach(async () => {
        capturedRequest = undefined;
        server = createServer((req, res) => {
            let rawBody = "";
            req.on("data", (chunk) => {
                rawBody += chunk;
            });
            req.on("end", () => {
                capturedRequest = {
                    method: req.method,
                    url: req.url,
                    body: JSON.parse(rawBody),
                };
                res.writeHead(200, {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json",
                });
                res.end(JSON.stringify(mockResponse));
            });
        });

        await new Promise<void>((resolve) => {
            server.listen(0, "127.0.0.1", resolve);
        });
        const { port } = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${port}`;
    });

    afterEach(async () => {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    });

    test("should generate text using the default PaLM2 text model", async () => {
        const palm2 = new Palm2AI({ apiKey: "test_api_key", baseUrl });
        const response = await palm2.chat({ prompt: "test prompt" });

        expect(capturedRequest).toEqual({
            method: "POST",
            url: "/v1beta3/models/text-bison-001:generateText?key=test_api_key",
            body: expect.objectContaining({
                prompt: {
                    text: "test prompt",
                },
                temperature: 0.7,
                candidate_count: 1,
                max_output_tokens: 1024,
            }),
        });
        expect(response).toEqual(mockResponse);
    });

    test("should allow overriding generation settings and model", async () => {
        const palm2 = new Palm2AI({
            apiKey: "test_api_key",
            model: "text-bison-001",
            apiVersion: "v1beta3",
            baseUrl,
        });
        await palm2.chat({
            prompt: "test prompt",
            model: "chat-bison-001",
            temperature: 0.2,
            candidate_count: 2,
            max_output_tokens: 256,
            top_k: 40,
            top_p: 0.95,
            max_retry: 1,
            delay: 1,
        });

        expect(capturedRequest).toEqual({
            method: "POST",
            url: "/v1beta3/models/chat-bison-001:generateText?key=test_api_key",
            body: expect.objectContaining({
                temperature: 0.2,
                candidate_count: 2,
                max_output_tokens: 256,
                top_k: 40,
                top_p: 0.95,
            }),
        });
    });
});
