# AWS Comprehend PII Redaction

This example shows how to redact PII from a prompt with AWS Comprehend before sending it to an EdgeChains AI endpoint.

## Setup

```bash
npm install
AWS_REGION=us-east-1 OPENAI_API_KEY=... npm start
```

The `ComprehendPiiRedactor` can wrap any endpoint with a `chat(...)` method:

```ts
const safeOpenAI = redactor.pipe(openAI);
await safeOpenAI.chat({ prompt: "Call Alice at 555-123-4567" });
```
