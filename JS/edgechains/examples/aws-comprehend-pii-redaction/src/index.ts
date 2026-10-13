/**
 * Offline-friendly demo for AWS Comprehend PII redaction (#290).
 *
 * DEMO_MODE=mock (default): injects a fake Comprehend client — no AWS credentials needed.
 * DEMO_MODE=live: uses real Comprehend + optional OpenAI wrapEndpoint.
 *
 * Env (live):
 *   AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *   OPENAI_API_KEY (optional — only if you want the wrapped chat call)
 */
import {
    AWSComprehendPiiRedactor,
    OpenAI,
    type ComprehendLikeClient,
    type DetectedPiiEntity,
} from "@arakoodev/edgechains.js/ai";

const DEMO_MODE = (process.env.DEMO_MODE || "mock").toLowerCase();

const SAMPLE =
    "Please email Jane Doe at jane.doe@example.com or call +1-555-010-9999 about SSN 078-05-1120.";

function buildMockClient(text: string): ComprehendLikeClient {
    // Deterministic synthetic entities for Loom / CI demos (no AWS).
    const entities: DetectedPiiEntity[] = [];
    const patterns: Array<{ needle: string; type: string }> = [
        { needle: "Jane Doe", type: "NAME" },
        { needle: "jane.doe@example.com", type: "EMAIL" },
        { needle: "+1-555-010-9999", type: "PHONE" },
        { needle: "078-05-1120", type: "SSN" },
    ];
    for (const { needle, type } of patterns) {
        const begin = text.indexOf(needle);
        if (begin >= 0) {
            entities.push({
                BeginOffset: begin,
                EndOffset: begin + needle.length,
                Score: 0.99,
                Type: type,
            });
        }
    }
    return {
        async send() {
            return { Entities: entities };
        },
    };
}

async function main() {
    console.log("=== EdgeChains AWS Comprehend PII redaction demo ===");
    console.log("mode:", DEMO_MODE);
    console.log("raw   :", SAMPLE);

    const redactor =
        DEMO_MODE === "live"
            ? new AWSComprehendPiiRedactor({
                  region: process.env.AWS_REGION || "us-east-1",
                  languageCode: "en",
                  minScore: 0.5,
              })
            : new AWSComprehendPiiRedactor({
                  client: buildMockClient(SAMPLE),
                  languageCode: "en",
                  minScore: 0.5,
              });

    const safe = await redactor.redact(SAMPLE);
    console.log("safe  :", safe);

    // Observable-style subscribe (no RxJS required)
    await new Promise<void>((resolve, reject) => {
        redactor.redact$(SAMPLE).subscribe({
            next: (value) => console.log("redact$:", value),
            error: reject,
            complete: () => resolve(),
        });
    });

    // Chain helper
    await redactor.chain(SAMPLE, async (redacted) => {
        console.log("chain :", redacted);
    });

    if (process.env.OPENAI_API_KEY) {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const wrapped = redactor.wrapEndpoint(openai);
        console.log("Calling OpenAI via wrapEndpoint (prompt already redacted)...");
        const reply = await wrapped.chat({
            prompt: SAMPLE,
            max_tokens: 64,
            temperature: 0,
        });
        console.log("llm   :", reply);
    } else {
        const fakeEndpoint = {
            async chat(opts: { prompt?: string }) {
                console.log("fakeEndpoint received prompt:", opts.prompt);
                return { content: "ACK (offline) — prompt contained no raw PII above." };
            },
        };
        const wrapped = redactor.wrapEndpoint(fakeEndpoint);
        const reply = await wrapped.chat({ prompt: SAMPLE });
        console.log("llm   :", reply);
    }

    console.log("=== done ===");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
