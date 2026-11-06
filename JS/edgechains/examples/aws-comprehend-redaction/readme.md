# AWS Comprehend PII Redaction Example (EdgeChains JS)

This example demonstrates how to chain `AwsComprehendRedact` (`ComprehendEndpoint`) as an observable with `OpenAI` using Jsonnet prompt templates (`jsonnet/main.jsonnet`).

## Setup

1. Add your AWS credentials and OpenAI API key to `jsonnet/secrets.jsonnet`.
2. Install dependencies and start the server:

```bash
npm install
npm start
```

3. Send a test request containing PII:

```bash
curl -X POST http://localhost:3000/redact \
  -H "Content-Type: application/json" \
  -d '{"inquiry": "My email is jane.doe@example.com and my SSN is 123-45-6789."}'
```
