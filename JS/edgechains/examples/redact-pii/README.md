# Redact PII with AWS Comprehend

Detects PII in a prompt with AWS Comprehend, masks it, and optionally sends the redacted prompt to OpenAI.

## Setup

1. Build the SDK: `cd ../../arakoodev && npm install && npm run build`
2. Install the example: `npm install`
3. Set environment variables (the IAM identity needs `comprehend:DetectPiiEntities`):

```bash
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_REGION=us-east-1
export OPENAI_API_KEY=...   # optional; if set, the redacted prompt is sent to OpenAI
```

## Run

```bash
npm start
npm start -- "Email Jane Doe at jane@example.com"
```

Example output:

```
Redacted: Write a reply to [NAME] ([EMAIL], phone [PHONE]) about his invoice.
```
