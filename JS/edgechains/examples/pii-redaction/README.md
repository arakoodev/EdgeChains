# PII Redaction Example

Demonstrates using `ComprehendPIIRedactor` from `@arakoodev/edgechains.js/pii-redactor` to detect and redact PII from text using AWS Comprehend.

## Prerequisites

- AWS credentials with Comprehend access configured
- Node.js 18+

```bash
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_REGION=us-east-1
```

## Run

```bash
npm install
npm start
```

## What it does

1. **Direct redaction** — Pass text, get PII stripped
2. **Promise chaining** — Use `.pipe()` with endpoint responses
3. **Conversation redaction** — Batch redact message arrays
4. **Type filtering** — Only redact specific PII types (e.g., EMAIL only)
