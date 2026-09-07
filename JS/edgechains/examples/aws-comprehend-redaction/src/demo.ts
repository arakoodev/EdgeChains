import { createRequire } from "node:module";
import { AWSComprehend, pipe } from "@arakoodev/edgechains.js/ai";

const require = createRequire(import.meta.url);
const { createDemoComprehendClient } = require("./lib/demoComprehendClient.cjs") as {
    createDemoComprehendClient: () => { send: (command: { input?: { Text?: string } }) => Promise<unknown> };
};

class FakeOpenAI {
    async chat(options: { prompt?: string }) {
        return {
            content: `Safe prompt received: ${options.prompt}`,
        };
    }
}

async function main() {
    const prompt =
        "Hi, I am Alice Johnson. Email me at alice@example.com. My SSN is 078-05-1120 and phone is 415-555-0199.";

    const comprehend = new AWSComprehend({
        client: createDemoComprehendClient(),
        maskMode: "REPLACE_WITH_PII_ENTITY_TYPE",
    });
    const openai = new FakeOpenAI();

    const detection = await comprehend.detectPiiEntities(prompt);
    const redacted = await comprehend.redactPrompt(prompt);
    const chained = comprehend.chain(openai);
    const chainedResponse = await chained.chat({ prompt });
    const pipedResponse = await pipe(prompt, comprehend.asOperator(), (safePrompt) =>
        openai.chat({ prompt: safePrompt })
    );

    console.log("Original prompt:");
    console.log(prompt);
    console.log("\nDetected entities:");
    console.log(JSON.stringify(detection, null, 2));
    console.log("\nRedacted prompt:");
    console.log(redacted);
    console.log("\nChained endpoint response:");
    console.log(chainedResponse);
    console.log("\nPromise pipe response:");
    console.log(pipedResponse);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
