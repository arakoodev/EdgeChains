# PII Redaction Chat (AWS Comprehend + EdgeChains)

Demonstrates chaining **Amazon Comprehend** PII detection in front of an LLM
endpoint class from `@arakoodev/edgechains.js`. Sensitive data (names, emails,
phone numbers, addresses, card numbers...) is masked before the prompt ever
reaches the model.

## Setup

```bash
npm install
```

Export credentials:

```bash
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=<your-key>
export AWS_SECRET_ACCESS_KEY=<your-secret>
export OPENAI_API_KEY=<your-openai-key>
```

## Run

```bash
npm start
```

## Demo video

See Loom walkthrough: <!-- add recorded demo link here -->

## API quick reference

```ts
const redactor = new ComprehendRedactor({ maskStyle: "asterisk" });
await redactor.redact(text);          // { redactedText, entities }

const safe = withPIIRedaction(client, redactor); // wraps any .chat() client
```
