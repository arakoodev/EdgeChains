import { ArakooServer } from "@arakoodev/edgechains.js/arakooserver";
import { OpenAI, AwsComprehendRedactor } from "@arakoodev/edgechains.js/ai";

const server = new ArakooServer();
const app = server.createApp();

const redactor = new AwsComprehendRedactor({
    region: process.env.AWS_REGION || "us-east-1",
    maskMode: "TYPE_TAG",
});

const openAi = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "",
});

app.post("/redact-and-chat", async (c: any) => {
    const { prompt } = await c.req.json();
    const { redaction, response } = await redactor
        .chainWithEndpoint(openAi, { prompt })
        .subscribe();

    return c.json({
        redactedPrompt: redaction.redactedText,
        detectedEntities: redaction.entities,
        llmResponse: response,
    });
});

server.listen(3000);
