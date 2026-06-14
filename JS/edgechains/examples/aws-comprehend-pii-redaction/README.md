# AWS Comprehend PII Redaction

This example shows how to redact sensitive prompt data before calling an AI endpoint.

```ts
import { AWSComprehendPIIRedactor, OpenAI } from "@arakoodev/edgechains.js/ai";

const redactor = new AWSComprehendPIIRedactor({ region: "us-east-1" });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const safeOpenAI = redactor.wrapChat(openai);
const response = await safeOpenAI.chat({
  prompt:
    "Summarize this customer note: Jane Doe, jane@example.com, called about billing.",
});
```

For local demos and tests, inject a mock `detectPiiEntities` client. This keeps verification fast and does not require AWS credentials.

Run the credential-free local demo:

```bash
npm install
npm run start
```

```ts
const redactor = new AWSComprehendPIIRedactor({
  client: {
    async detectPiiEntities() {
      return {
        Entities: [
          { Type: "NAME", BeginOffset: 30, EndOffset: 38, Score: 0.99 },
          { Type: "EMAIL", BeginOffset: 40, EndOffset: 56, Score: 0.99 },
        ],
      };
    },
  },
});
```
