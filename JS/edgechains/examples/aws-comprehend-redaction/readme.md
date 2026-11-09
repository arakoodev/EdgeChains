# AWS Comprehend PII Redaction Example

Demonstrates chaining `AWSComprehend` (`@arakoodev/edgechains.js/ai`) as an observable with `OpenAI` and Jsonnet prompt templates to automatically detect and redact PII entities (`NAME`, `EMAIL`, `SSN`, `PHONE`, etc.) before sending prompts to the LLM.

## Setup

1. Configure credentials in `jsonnet/secrets.jsonnet`.
2. Install dependencies and start the server:

```bash
npm install
npm start
```

3. Send a POST request to `http://localhost:3000/redact-chat`:

```bash
curl -X POST http://localhost:3000/redact-chat \
  -H "Content-Type: application/json" \
  -d '{"transcript": "Hi, my name is Jane Doe, email jane.doe@example.com, SSN 123-45-6789."}'
```
