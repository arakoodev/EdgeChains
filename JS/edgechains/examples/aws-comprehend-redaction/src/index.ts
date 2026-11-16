import {
    ComprehendClient,
    DetectPiiEntitiesCommand,
} from "@aws-sdk/client-comprehend";
import { AwsComprehendRedactor, OpenAI } from "@arakoodev/edgechains.js/ai";

const comprehend = new ComprehendClient({
    region: process.env.AWS_REGION || "us-east-1",
});

const redactor = new AwsComprehendRedactor({
    client: comprehend,
    detectPiiEntitiesCommand: DetectPiiEntitiesCommand,
});

const openAI = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    orgId: process.env.OPENAI_ORG_ID,
});

const promptOptions = await redactor.redactPrompt({
    prompt: "Summarize this customer message: email me@example.com called from 415-555-1212",
});

const response = await openAI.chat(promptOptions);
console.log(response.content);
