import { ComprehendRedactor } from "../lib/comprehend/comprehend.js";

describe("ComprehendRedactor", () => {
    const mockFetch = jest.fn<typeof fetch>();

    beforeEach(() => {
        mockFetch.mockReset();
        mockFetch.mockResolvedValue(
            new Response(
                JSON.stringify({
                    Entities: [
                        { BeginOffset: 6, EndOffset: 22, Score: 0.99, Type: "EMAIL" },
                    ],
                }),
                { status: 200 }
            )
        );
    });

    it("signs the request and redacts detected PII", async () => {
        const redactor = new ComprehendRedactor({
            accessKeyId: "AKIAEXAMPLE",
            secretAccessKey: "secret",
            endpoint: "https://comprehend.us-east-1.amazonaws.com/",
            fetch: mockFetch,
            clock: () => new Date("2026-08-02T15:00:00.000Z"),
        });

        await expect(redactor.redact("email test@example.com")).resolves.toBe("email [REDACTED]");
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, init] = mockFetch.mock.calls[0];
        expect(String(url)).toBe("https://comprehend.us-east-1.amazonaws.com/");
        expect(init?.method).toBe("POST");
        expect(init?.headers).toMatchObject({
            "x-amz-target": "Comprehend_20171127.DetectPiiEntities",
        });
        expect(String(init?.headers && (init.headers as Record<string, string>).authorization)).toContain(
            "AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE/20260802/us-east-1/comprehend/aws4_request"
        );
    });

    it("fails closed when credentials are missing", async () => {
        const redactor = new ComprehendRedactor({ fetch: mockFetch });
        await expect(redactor.detectPiiEntities("private text")).rejects.toThrow("AWS credentials");
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("redacts before invoking a downstream endpoint", async () => {
        const redactor = new ComprehendRedactor({
            accessKeyId: "key",
            secretAccessKey: "secret",
            fetch: mockFetch,
        });
        const endpoint = jest.fn(async (prompt: string) => prompt.length);
        await expect(redactor.protect("email test@example.com", endpoint)).resolves.toBe(16);
        expect(endpoint).toHaveBeenCalledWith("email [REDACTED]");
    });
});
