import { ComprehendRedactor } from "@arakoodev/edgechains.js/ai";

const sampleText = "Alice Nguyen can be reached at alice@example.com.";

const redactor = new ComprehendRedactor({
    detector: async () => ({
        Entities: [
            { Type: "NAME", BeginOffset: 0, EndOffset: 12, Score: 0.99 },
            { Type: "EMAIL", BeginOffset: 31, EndOffset: 48, Score: 0.99 },
        ],
    }),
});

const result = await redactor.redactText(sampleText);

console.log(result.text);
