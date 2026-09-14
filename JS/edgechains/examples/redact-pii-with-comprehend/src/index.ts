import { ComprehendRedactor, OpenAI } from "@arakoodev/edgechains.js/ai";
import { concatMap, from, lastValueFrom } from "rxjs";

const redactor = new ComprehendRedactor({
    region: process.env.AWS_REGION ?? "us-east-1",
    replacement: (entityType) => `[${entityType}]`,
});
const openAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const incomingPrompt = "Please email Alice at alice@example.com about order 12345.";

// RxJS pipeline: redact prompt data before it reaches an existing EdgeChains endpoint.
const responses = from([{ prompt: incomingPrompt }]).pipe(
    redactor.redactChatOptionsOperator<{ prompt: string }>(),
    concatMap(({ prompt }) => from(openAI.chat({ prompt })))
);

console.log(await lastValueFrom(responses));
