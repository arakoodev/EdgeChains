import {
    AWSComprehendRedactor,
    type ComprehendPiiClient,
    type PromptChatOptions,
} from "@arakoodev/edgechains.js/ai/aws-comprehend";

const samplePrompt =
    "Please summarize this support ticket from Jane Doe. Email: jane@example.com. Phone: 555-1212.";

const offlineClient: ComprehendPiiClient = {
    async detectPiiEntities({ Text }) {
        const entities = [
            { value: "Jane Doe", type: "NAME" },
            { value: "jane@example.com", type: "EMAIL" },
            { value: "555-1212", type: "PHONE" },
        ]
            .map(({ value, type }) => {
                const start = Text.indexOf(value);
                return {
                    BeginOffset: start,
                    EndOffset: start + value.length,
                    Score: 0.99,
                    Type: type,
                };
            })
            .filter((entity) => entity.BeginOffset >= 0);

        return { Entities: entities };
    },
};

const useRealAws =
    Boolean(process.env.AWS_ACCESS_KEY_ID) && Boolean(process.env.AWS_SECRET_ACCESS_KEY);

const redactor = new AWSComprehendRedactor({
    client: useRealAws ? undefined : offlineClient,
    region: process.env.AWS_REGION || "us-east-1",
});

const redaction = await redactor.redactText(samplePrompt);
console.log("Original prompt:");
console.log(redaction.originalText);
console.log("\nRedacted prompt:");
console.log(redaction.redactedText);

const mockEndpoint = {
    async chat(options: PromptChatOptions) {
        return {
            content: `Endpoint received safe prompt: ${options.prompt}`,
        };
    },
};

const safeEndpoint = redactor.chainEndpoint(mockEndpoint);
const response = await safeEndpoint.chat({ prompt: samplePrompt });
console.log("\nEndpoint response:");
console.log(response.content);
