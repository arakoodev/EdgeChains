import {
    ComprehendPiiRedactor,
    RedactionObservable,
} from "@arakoodev/edgechains.js/aws-comprehend";
import { OpenAI } from "@arakoodev/edgechains.js/ai";
import { mergeMap } from "rxjs/operators";

import { resolveClientOptions } from "./lib/localDetector.js";

const TRANSCRIPT = [
    "Agent: Good morning, how can I help you today?",
    "Customer: Hi, my name is Jane Smith. SSN is 123-45-6789.",
    "Customer: I moved recently, my new address is 221B Baker Street.",
    "Customer: You can reach me at 555-010-1234 or jane.doe@example.com.",
    "Agent: Noted. Could you confirm the card used for the last order?",
    "Customer: Sure, it is 4111 1111 1111 1111.",
].join("\n");

async function main(): Promise<void> {
    const redactor = new ComprehendPiiRedactor(resolveClientOptions());

    console.log("--- Original transcript ---");
    console.log(TRANSCRIPT);

    const detected = await redactor.detect(TRANSCRIPT);
    console.log("\n--- Detected PII entities (Amazon Comprehend DetectPiiEntities) ---");
    for (const entity of detected) {
        console.log(
            `  ${TRANSCRIPT.substring(entity.beginOffset, entity.endOffset).trim()} ` +
                `-> ${entity.type} (score ${entity.score.toFixed(2)})`
        );
    }

    // Redaction as a chainable observable. RedactionObservable accepts the
    // prompt directly or any observable of strings coming from an endpoint.
    const redacted$ = new RedactionObservable(TRANSCRIPT, redactor);
    const redactedPrompt = await redacted$.get();

    console.log("\n--- Redacted transcript ---");
    console.log(redactedPrompt);

    if (!process.env.OPENAI_API_KEY) {
        console.log(
            "\nOPENAI_API_KEY not set; skipping the OpenAI call. " +
                "The transcript above is exactly the prompt the endpoint " +
                "would receive."
        );
        return;
    }

    // Chain the redaction into the OpenAI endpoint class. mergeMap turns
    // the endpoint promise into an observable, so the whole pipeline stays
    // in the observable world.
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion$ = redacted$.pipe(mergeMap((prompt) => openai.chat({ prompt, role: "user" })));

    console.log("\n--- Chain: transcript -> RedactionObservable -> OpenAI ---");
    completion$.subscribe({
        next: (response) => console.log(response.content),
        error: (error) => {
            console.error("Pipeline failed:", error.message);
            process.exit(1);
        },
    });
}

main().catch((error) => {
    console.error("Example failed:", error);
    process.exit(1);
});
