# PII Redaction with AWS Comprehend

This example demonstrates the `ComprehendPiiRedactor` utility from `@arakoodev/edgechains.js/comprehend`:

1. Detecting PII in a prompt with Amazon Comprehend (`DetectPiiEntities`) and redacting it
   (replaced by the entity type, e.g. `[NAME]`, or masked with a character).
2. Chaining the redactor in front of the existing `OpenAI` endpoint class, with an
   observable-style `subscribe` that logs every redaction.

## Setup

```bash
npm install
```

Export your AWS credentials (Comprehend) and OpenAI key:

```bash
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=<your-access-key-id>
export AWS_SECRET_ACCESS_KEY=<your-secret-access-key>
export OPENAI_API_KEY=<your-openai-key>
```

The IAM identity needs the `comprehend:DetectPiiEntities` permission.

## Run

```bash
npm start
```

Expected output (truncated):

```
Detected PII: NAME(1.00), ADDRESS(0.99), EMAIL(1.00), PHONE(1.00)
Redacted prompt: Hi, I'm [NAME] living at [ADDRESS], Seattle. My email is [EMAIL] and my phone is [PHONE]. Can you summarize my last order #84921?
[observer] redacted 4 PII entities
LLM response: ...
```
