// Example for issue #290 - AWS Comprehend PII redaction.
//
//   pnpm install
//   cp .env.example .env       # add AWS_* + OPENAI_API_KEY
//   pnpm start                 # promise-style demo
//   pnpm run stream            # rxjs / observable demo

import "dotenv/config";
import { from } from "rxjs";
import { mergeMap, tap } from "rxjs/operators";

import {
    AWSComprehend,
    OpenAI,
    redactPii,
} from "@arakoodev/edgechains.js/ai";

const dirtyPrompts: string[] = [
    "Hi, I'm Sarah Chen (sarah.chen@acme.io). My phone is 415-555-0142. Can you draft a polite reply to my landlord asking for a 30-day extension?",
    "My SSN 123-45-6789 was on a leaked spreadsheet, what should I do? My credit card 4111 1111 1111 1111 may also be exposed.",
    "Please summarize: Patient John Doe (DOB 1979-04-12) presented with chest pain. Address: 742 Evergreen Terrace, Springfield.",
];

async function demoPromiseChain() {
    console.log("\n== Promise chaining (comprehend.chain -> openai.chat) ==\n");

    const comprehend = new AWSComprehend();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    for (const prompt of dirtyPrompts) {
        console.log("ORIGINAL :", prompt);

        const reply = await comprehend.chain(
            prompt,
            (safePrompt) => {
                console.log("REDACTED :", safePrompt);
                return openai.chat({ prompt: safePrompt, max_tokens: 120 });
            },
            { strategy: "type" } // -> [EMAIL], [PHONE], [SSN] ...
        );

        console.log(
            "LLM REPLY:",
            typeof reply === "string" ? reply : (reply as any)?.content
        );
        console.log();
    }
}

async function demoObservableChain() {
    console.log("\n== Observable chaining (RxJS pipe) ==\n");

    const comprehend = new AWSComprehend();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    await new Promise<void>((resolve, reject) => {
        from(dirtyPrompts)
            .pipe(
                tap((p) => console.log("ORIGINAL :", p)),
                redactPii(comprehend, { strategy: "type" }, 2),
                tap((r) => console.log("REDACTED :", r.redactedText)),
                mergeMap((r) =>
                    openai.chat({ prompt: r.redactedText, max_tokens: 120 })
                )
            )
            .subscribe({
                next: (reply) => {
                    const content =
                        typeof reply === "string"
                            ? reply
                            : (reply as any)?.content;
                    console.log("LLM REPLY:", content);
                    console.log();
                },
                error: reject,
                complete: resolve,
            });
    });
}

async function main() {
    if (process.argv.includes("--stream")) {
        await demoObservableChain();
    } else {
        await demoPromiseChain();
    }
}

main().catch((err) => {
    console.error("\n[example] failed:", err);
    process.exit(1);
});
