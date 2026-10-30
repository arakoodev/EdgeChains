/**
 * Example: redact PII from a prompt before sending it to any endpoint.
 * Run: npx tsx examples/redact-demo.ts
 */
import { ComprehendRedactor, RedactEndpointDecorator } from "../../arakoodev/src/ai/src/lib/redact";

async function main() {
    // real AWS Comprehend if creds present, else deterministic local fallback
    const redactor = new ComprehendRedactor({ region: "us-east-1" });

    const prompt = "Hi, I'm Jane Doe (jane.doe@example.com, +1 555 123 4567). SSN 123-45-6789.";
    const { redactedText, spans } = await redactor.redact(prompt);
    console.log("original :", prompt);
    console.log("redacted :", redactedText);
    console.log("detected :", spans.map((s) => s.type).join(", "));

    // Chain with any endpoint-like object exposing run/send/call:
    const fakeEndpoint = {
        async run(text: string) {
            return `sent to model: ${text}`;
        },
    };
    const safeEndpoint = new RedactEndpointDecorator(fakeEndpoint, redactor);
    console.log(await safeEndpoint.run(prompt));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
