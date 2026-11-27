import dotenv from "dotenv";
import { firstValueFrom, from, of, toArray } from "rxjs";
import {
    AWSComprehendRedactor,
    ComprehendObservable,
    ComprehendRedactionChain,
    OpenAiEndpoint,
    type EndpointLike,
    type EndpointChatOptions,
    type ChatMessage,
    type ComprehendClientLike,
    type PiiEntity,
} from "@arakoodev/edgechains.js/ai";

dotenv.config();

/**
 * In-memory simulated AWS Comprehend client used when live AWS credentials
 * are not present in the runtime environment. This guarantees the example runs
 * end-to-end out-of-the-box for developers and reviewers without requiring
 * live AWS account keys.
 */
function createDemoMockComprehendClient(): ComprehendClientLike {
    return {
        detectPiiEntities: async ({ Text }: { Text: string }) => {
            const entities: PiiEntity[] = [];
            const utf8Buffer = Buffer.from(Text, "utf-8");

            const patterns: Array<{ regex: RegExp; type: string }> = [
                {
                    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
                    type: "EMAIL",
                },
                {
                    regex: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
                    type: "PHONE",
                },
                {
                    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
                    type: "SSN",
                },
                {
                    regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
                    type: "CREDIT_DEBIT_NUMBER",
                },
                {
                    regex: /\b(?:John Doe|Jane Smith|Alice Cooper|Bob Johnson|Carlos Santana)\b/g,
                    type: "NAME",
                },
                {
                    regex: /\b\d{1,5}\s+[A-Za-z0-9\s.,]+(?:Avenue|Lane|Road|Boulevard|Drive|Street|Ave|Dr|St|Rd)\b/g,
                    type: "ADDRESS",
                },
            ];

            for (const { regex, type } of patterns) {
                let match: RegExpExecArray | null;
                while ((match = regex.exec(Text)) !== null) {
                    const matchText = match[0];
                    const startChar = match.index;
                    const endChar = startChar + matchText.length;

                    const beginOffset = Buffer.byteLength(Text.slice(0, startChar), "utf-8");
                    const endOffset = Buffer.byteLength(Text.slice(0, endChar), "utf-8");

                    entities.push({
                        Score: 0.99,
                        Type: type as PiiEntity["Type"],
                        BeginOffset: beginOffset,
                        EndOffset: endOffset,
                    });
                }
            }

            return { Entities: entities };
        },
    };
}

/**
 * Mock LLM endpoint simulating an OpenAI or Llama service.
 */
class DemoEndpoint implements EndpointLike {
    name = "DemoOpenAI";
    [key: string]: unknown;

    async chat(options: EndpointChatOptions) {
        const promptReceived =
            options.prompt ||
            (Array.isArray(options.messages)
                ? options.messages.map((m) => `${m.role}: ${m.content}`).join("\n")
                : "");

        return {
            id: "chatcmpl-" + Math.random().toString(36).slice(2, 9),
            model: "gpt-3.5-turbo",
            choices: [
                {
                    message: {
                        role: "assistant",
                        content: `[LLM Response] Successfully processed safe prompt without PII leaks: "${promptReceived}"`,
                    },
                },
            ],
        };
    }
}

async function main() {
    console.log("=======================================================================");
    console.log(" EdgeChains - AWS Comprehend PII Redaction & Observable Chaining Demo ");
    console.log("=======================================================================\n");

    const hasAwsCreds = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

    if (hasAwsCreds) {
        console.log(
            ">> Using live AWS Comprehend client (region: " +
                (process.env.AWS_REGION || "us-east-1") +
                ")."
        );
    } else {
        console.log(">> No AWS credentials in environment; using simulated Comprehend client.");
        console.log("   (Set AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY to use live AWS).\n");
    }

    const redactor = new AWSComprehendRedactor(
        hasAwsCreds
            ? { region: process.env.AWS_REGION || "us-east-1" }
            : { client: createDemoMockComprehendClient() }
    );

    // -------------------------------------------------------------------------
    // 1. Direct Redaction: Default REPLACE_WITH_PII_ENTITY_TYPE Mode
    // -------------------------------------------------------------------------
    console.log("--- 1. Direct Redaction (Default Entity-Type Mode) ---");
    const sampleEmail = "john.doe" + "@" + "example.com";
    const sampleSsn = "123" + "-45" + "-6789";
    const samplePrompt = `Customer John Doe with email ${sampleEmail}, phone 415-555-0199, and SSN ${sampleSsn} requested a loan statement for 123 Market Street.`;
    console.log("Original Prompt:\n ", samplePrompt);

    const redactedDefault = await redactor.redact(samplePrompt);
    console.log("\nRedacted Prompt:\n ", redactedDefault);

    const detailed = await redactor.redactDetailed(samplePrompt);
    console.log(`\nDetected ${detailed.redactedEntityCount} sensitive entities:`);
    for (const ent of detailed.entities) {
        console.log(` - Type: ${ent.Type?.padEnd(20)} Score: ${(ent.Score ?? 0).toFixed(2)}`);
    }

    // -------------------------------------------------------------------------
    // 2. Direct Redaction: MASK and CUSTOM Mode
    // -------------------------------------------------------------------------
    console.log("\n--- 2. Direct Redaction (MASK & CUSTOM Modes) ---");
    const masked = await redactor.redact(samplePrompt, {
        maskMode: "MASK",
        maskCharacter: "*",
    });
    console.log("Masked (***):\n ", masked);

    const custom = await redactor.redact(samplePrompt, {
        maskMode: "CUSTOM",
        customPlaceholder: (ent, orig) => `[SENSITIVE_${ent.Type}:len=${orig.length}]`,
    });
    console.log("Custom Formatter:\n ", custom);

    // -------------------------------------------------------------------------
    // 3. Multi-turn Chat Message Redaction
    console.log("\n--- 3. Multi-turn Chat Messages Redaction ---");
    const janeEmail = "jane.smith" + "@" + "example.com";
    const janeCard = "4111" + "-2222-" + "3333-4444";
    const chatHistory: ChatMessage[] = [
        { role: "system", content: "You are a customer support AI assistant." },
        {
            role: "user",
            content: `Hi, my name is Jane Smith and my credit card is ${janeCard}.`,
        },
        { role: "assistant", content: "How can I help you today, Jane?" },
        {
            role: "user",
            content: `Please email the receipt to ${janeEmail}.`,
        },
    ];

    const sanitizedChat = await redactor.redactMessages(chatHistory);
    console.log("Sanitized Chat History:");
    for (const msg of sanitizedChat) {
        console.log(` [${msg.role}]: ${msg.content}`);
    }

    // -------------------------------------------------------------------------
    // 4. Chaining with Endpoint Classes (OpenAI / OpenAiEndpoint / LlamaAI)
    // -------------------------------------------------------------------------
    console.log("\n--- 4. Chaining Redactor with Endpoint Classes ---");
    const endpoint = new DemoEndpoint();

    const chainResult = await redactor.chain<{
        choices: Array<{ message: { content: string } }>;
    }>(endpoint, { prompt: samplePrompt });
    console.log("LLM Response via redactor.chain():");
    console.log(" ", chainResult.choices[0].message.content);

    // Transparently wrapped endpoint
    const wrappedEndpoint = redactor.wrap(endpoint);
    const aliceEmail = "alice.cooper" + "@" + "example.com";
    const wrappedResult = (await wrappedEndpoint.chat!({
        prompt: `Contact Alice Cooper at ${aliceEmail}.`,
    })) as { choices: Array<{ message: { content: string } }> };
    console.log("\nLLM Response via transparent redactor.wrap(endpoint):");
    console.log(" ", wrappedResult.choices[0].message.content);

    // -------------------------------------------------------------------------
    // 5. Observable Chaining via ComprehendObservable Operators
    // -------------------------------------------------------------------------
    console.log("\n--- 5. RxJS Observable Stream Pipeline ---");
    const bobEmail = "bob.johnson" + "@" + "example.com";
    const bobCard = "5500" + "-0000-" + "0000-0004";
    const userPromptStream$ = of(
        "Inquiry from Bob Johnson: reach me at 212-555-0144.",
        `Payment verification for ${bobEmail}, card ${bobCard}.`,
        "Ship order to Carlos Santana at 456 Elm Street."
    );

    console.log("Streaming prompts through ComprehendObservable.redact pipeline:");
    const redactedStream$ = userPromptStream$.pipe(ComprehendObservable.redact(redactor));

    const redactedList = await firstValueFrom(redactedStream$.pipe(toArray()));
    redactedList.forEach((text, i) => {
        console.log(` [Prompt ${i + 1}]: ${text}`);
    });

    console.log("\nStreaming prompts directly to Endpoint via ComprehendObservable.chainEndpoint:");
    const endToEndStream$ = userPromptStream$.pipe(
        ComprehendObservable.chainEndpoint<{
            choices: Array<{ message: { content: string } }>;
        }>(redactor, endpoint)
    );

    const endpointOutputs = await firstValueFrom(endToEndStream$.pipe(toArray()));
    endpointOutputs.forEach((out, i) => {
        console.log(` [Response ${i + 1}]: ${out.choices[0].message.content}`);
    });

    // -------------------------------------------------------------------------
    // 6. ComprehendRedactionChain High-Level Interface
    // -------------------------------------------------------------------------
    console.log("\n--- 6. ComprehendRedactionChain Pipeline ---");
    const pipeline = new ComprehendRedactionChain({
        redactor,
        endpoint,
    });

    const notifySsn = "987" + "-65" + "-4321";
    const pipelineResult$ = pipeline.runObservable<{
        choices: Array<{ message: { content: string } }>;
    }>({
        prompt: `Notify John Doe regarding SSN ${notifySsn}.`,
    });

    const singleResult = await firstValueFrom(pipelineResult$);
    console.log("Pipeline Observable Result:");
    console.log(" ", singleResult.choices[0].message.content);

    console.log("\n=======================================================================");
    console.log(" Demo Completed Successfully!");
    console.log("=======================================================================");
}

main().catch((err) => {
    console.error("Demo failed with error:", err);
    process.exit(1);
});
