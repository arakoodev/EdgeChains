import {
    AwsComprehendClient,
    AwsComprehendRedactor,
    ComprehendClient,
    fromPrompts,
} from "@arakoodev/edgechains.js/ai";

const samplePrompt = "Please summarize this request from Jane Smith at jane@example.com.";

const mockClient: ComprehendClient = {
    async detectPiiEntities() {
        return {
            Entities: [
                { Type: "NAME", Score: 0.99, BeginOffset: 35, EndOffset: 45 },
                { Type: "EMAIL", Score: 0.99, BeginOffset: 49, EndOffset: 65 },
            ],
        };
    },
};

const client =
    process.env.USE_REAL_AWS === "1"
        ? new AwsComprehendClient({ region: process.env.AWS_REGION || "us-east-1" })
        : mockClient;

const redactor = new AwsComprehendRedactor({ client });

const endpointResponse = await redactor.chain(samplePrompt, async (safePrompt) => {
    return {
        endpoint: "OpenAI-compatible endpoint",
        promptReceived: safePrompt,
    };
});

console.log("Promise chain result:");
console.log(endpointResponse);

console.log("Observable chain result:");
await new Promise<void>((resolve, reject) => {
    redactor.redactObservable(fromPrompts([samplePrompt])).subscribe({
        next: (result) => console.log(result.redactedText),
        error: reject,
        complete: resolve,
    });
});
