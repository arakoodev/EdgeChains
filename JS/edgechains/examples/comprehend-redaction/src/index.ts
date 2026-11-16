import http from "http";
import {
    ComprehendRedact,
    ComprehendRedactOptions,
} from "../../../arakoodev/src/ai/src/lib/comprehend-redaction/redact.js";

/**
 * Full working example for issue #290: PII redaction chained with the
 * EdgeChains SDK, backed by Amazon Comprehend (DetectPiiEntities).
 *
 * Bimodal — the same code path runs against the local stub or the live service:
 * - LOCAL MOCK (default): when no AWS credentials are present, a tiny in-process
 *   Comprehend stub answers DetectPiiEntities, so it works with zero AWS config.
 * - REAL AWS: set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (optionally
 *   AWS_SESSION_TOKEN / AWS_REGION / COMPREHEND_ENDPOINT) to sign the request
 *   and call the live https://comprehend.<region>.amazonaws.com/ service.
 *
 * MOCK=1 forces the local stub even when credentials are present.
 */
async function main(): Promise<void> {
    const hasAwsCreds = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    const useMock = process.env.MOCK === "1" || !hasAwsCreds;
    const region = process.env.AWS_REGION || "us-east-1";

    const opts: ComprehendRedactOptions = { region };
    let server: http.Server | undefined;

    if (useMock) {
        console.log(
            "[mode] LOCAL Comprehend mock — set AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY to use the real service"
        );
        // --- Local Comprehend mock (detects EMAIL and PHONE patterns) ---
        const mock = http.createServer((req, res) => {
            let body = "";
            req.on("data", (c) => (body += c));
            req.on("end", () => {
                let parsed: unknown;
                try {
                  parsed = JSON.parse(body || "{}");
                } catch {
                  parsed = {};
                }
                const record =
                  parsed !== null && typeof parsed === "object"
                    ? (parsed as Record<string, unknown>)
                    : {};
                const text: string = typeof record.Text === "string" ? record.Text : "";
                const result: Array<{
                    BeginOffset: number;
                    EndOffset: number;
                    Score: number;
                    Type: string;
                }> = [];
                const email = /([\w.+-]+@\w[-\w.]*[a-z]{2,})/gi;
                let m: RegExpExecArray | null;
                while ((m = email.exec(text))) {
                    result.push({
                        BeginOffset: m.index,
                        EndOffset: m.index + m[0].length,
                        Score: 0.99,
                        Type: "EMAIL",
                    });
                }
                const phone = /\b\d{3}-\d{3}-\d{4}\b/.exec(text);
                if (phone)
                    result.push({
                        BeginOffset: phone.index,
                        EndOffset: phone.index + phone[0].length,
                        Score: 0.98,
                        Type: "PHONE",
                    });
                res.setHeader("content-type", "application/json");
                res.end(JSON.stringify({ Entities: result }));
            });
        });
        await new Promise<void>((resolve) => mock.listen(0, "127.0.0.1", resolve));
        const port = (mock.address() as { port: number }).port;
        server = mock;
        opts.endpoint = `http://127.0.0.1:${port}/`;
        opts.accessKeyId = "DEMO_KEY";
        opts.secretAccessKey = "DEMO_SECRET";
    } else {
        // Real Amazon Comprehend. ComprehendRedact reads the credentials from
        // AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_SESSION_TOKEN; the
        // endpoint defaults to https://comprehend.<region>.amazonaws.com/ unless
        // COMPREHEND_ENDPOINT overrides it (e.g. a VPC endpoint).
        if (process.env.COMPREHEND_ENDPOINT) opts.endpoint = process.env.COMPREHEND_ENDPOINT;
        console.log(
            `[mode] REAL Amazon Comprehend — region ${region}, endpoint ${
                opts.endpoint ?? `https://comprehend.${region}.amazonaws.com/`
            }`
        );
    }

    const redact = new ComprehendRedact(opts);

    const prompt =
        "Please summarize this note from jane.doe@example.com, her cell is 415-555-0132.";
    console.log("[1] Prompt original:  ", prompt);

    const tagged = await redact.redactText(prompt, "TAG");
    console.log("[2] Redacted (TAG):   ", tagged);

    const masked = await redact.redactText(prompt, "MASK");
    console.log("[3] Redacted (MASK):  ", masked);

    // Observable chaining (thenable + subscribe + async iterator)
    const observable = redact.redactObservable(prompt);
    observable.subscribe((value) => console.log("[4] Observable:       ", value));
    // subscribe() returns void; await the thenable so [4] prints deterministically.
    await observable;

    // Chain with an existing Endpoint class (e.g. OpenAI) before it sees the prompt
    const fakeOpenAI = {
        async chat(o: { prompt: string }) {
            console.log("[5] Endpoint.chat received:", o.prompt);
            return { content: "Summarized with PII already redacted." };
        },
    };
    const out = await redact.chainWithEndpoint(fakeOpenAI, prompt, { mode: "MASK" });
    console.log("[6] Endpoint result:  ", out);

    if (server) server.close();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
