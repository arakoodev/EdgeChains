import http from "http";
import { ComprehendRedact } from "../../../arakoodev/src/ai/src/lib/comprehend-redaction/redact.js";

/**
 * Full working example for issue #290: PII redaction chained with the
 * EdgeChains SDK, backed by Amazon Comprehend (DetectPiiEntities).
 *
 * Runs against a tiny local Comprehend mock so it works with zero AWS
 * configuration — point `endpoint` at
 * https://comprehend.{region}.amazonaws.com/ to use the real service.
 */
async function main(): Promise<void> {
    // --- Local Comprehend mock (detects EMAIL and PHONE patterns) ---
    const server = http.createServer((req, res) => {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
            const parsed = JSON.parse(body || "{}");
            const text: string = parsed.Text ?? "";
            const result: Array<{ BeginOffset: number; EndOffset: number; Score: number; Type: string }> = [];
            const email = /([\w.+-]+@\w[-\w.]*[a-z]{2,})/gi;
            let m: RegExpExecArray | null;
            while ((m = email.exec(text))) {
                result.push({ BeginOffset: m.index, EndOffset: m.index + m[0].length, Score: 0.99, Type: "EMAIL" });
            }
            const phone = /\b\d{3}-\d{3}-\d{4}\b/.exec(text);
            if (phone) result.push({ BeginOffset: phone.index, EndOffset: phone.index + phone[0].length, Score: 0.98, Type: "PHONE" });
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ Entities: result }));
        });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as { port: number }).port;

    const redact = new ComprehendRedact({
        accessKeyId: "DEMO_KEY",
        secretAccessKey: "DEMO_SECRET",
        region: "us-east-1",
        endpoint: `http://127.0.0.1:${port}/`,
    });

    const prompt = "Please summarize this note from jane.doe@example.com, her cell is 415-555-0132.";
    console.log("[1] Prompt original:  ", prompt);

    const tagged = await redact.redactText(prompt, "TAG");
    console.log("[2] Redacted (TAG):   ", tagged);

    const masked = await redact.redactText(prompt, "MASK");
    console.log("[3] Redacted (MASK):  ", masked);

    // Observable chaining (thenable + subscribe + async iterator)
    await redact.redactObservable(prompt).subscribe((v) => console.log("[4] Observable:       ", v));

    // Chain with an existing Endpoint class (e.g. OpenAI) before it sees the prompt
    const fakeOpenAI = {
        async chat(opts: { prompt: string }) {
            console.log("[5] Endpoint.chat received:", opts.prompt);
            return { content: "Summarized with PII already redacted." };
        },
    };
    const out = await redact.chainWithEndpoint(fakeOpenAI, prompt, { mode: "MASK" });
    console.log("[6] Endpoint result:  ", out);

    server.close();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
