import { firstValueFrom } from "rxjs";
import {
  AwsComprehendRedactor,
  OpenAI,
  type ComprehendClientLike,
} from "@arakoodev/edgechains.js/ai";

const mockClient: ComprehendClientLike = {
  async send() {
    return {
      Entities: [
        { BeginOffset: 6, EndOffset: 9, Score: 1, Type: "NAME" },
        { BeginOffset: 13, EndOffset: 28, Score: 1, Type: "EMAIL" },
        { BeginOffset: 43, EndOffset: 54, Score: 1, Type: "SSN" },
      ],
      $metadata: {},
    };
  },
};

const redactor = new AwsComprehendRedactor({
  client: process.env.MOCK_COMPREHEND === "1" ? mockClient : undefined,
  region: process.env.AWS_REGION ?? "us-east-1",
  minScore: 0.8,
});

const prompt =
  process.argv.slice(2).join(" ") ||
  "Email Ada at ada@example.com about account 123-45-6789.";

console.log("Redacted:", await redactor.redact(prompt));

if (process.env.OPENAI_API_KEY) {
  const endpoint = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    orgId: process.env.OPENAI_ORG_ID,
  });
  const response = await firstValueFrom(redactor.chat$(endpoint, { prompt }));
  console.log("LLM response:", response.content);
}
