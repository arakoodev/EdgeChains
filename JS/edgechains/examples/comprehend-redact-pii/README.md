# Redact PII with Amazon Comprehend

Shows the `ComprehendRedactor` from the EdgeChains `redact` module:

1. detecting PII entities in a customer-support transcript with Amazon Comprehend,
2. redacting them (entity-type labels or masking), and
3. chaining the redactor with the OpenAI endpoint so prompts are redacted
   before they ever leave your system.

## Setup

```bash
npm install
cp .env.example .env   # fill in AWS_REGION / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
npm start
```

An IAM identity with the `comprehend:DetectPiiEntities` permission is enough.
Amazon Comprehend's free tier covers 50K units (5M characters) per API per
month for the first 12 months - this example uses well under 1K characters.

Set `OPENAI_API_KEY` to also send the redacted prompt to the OpenAI endpoint;
without it the example just prints the redacted prompt.
