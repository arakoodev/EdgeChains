# AWS Comprehend redaction example

This example redacts PII from a prompt before sending it to an LLM endpoint.

## Setup

```sh
npm install
AWS_REGION=us-east-1 OPENAI_API_KEY=... npm start
```

The `AwsComprehendRedactor` uses Amazon Comprehend's `DetectPiiEntities` API and replaces detected spans with labels such as `[REDACTED:EMAIL]`.

```ts
import { AwsComprehendRedactor } from "@arakoodev/edgechains.js/ai";

const redactor = new AwsComprehendRedactor({
  region: "us-east-1",
  languageCode: "en",
  minScore: 0.8,
});

const prompt = await redactor.redactPrompt(
  "Contact jane@example.com at +15551234567"
);
```
