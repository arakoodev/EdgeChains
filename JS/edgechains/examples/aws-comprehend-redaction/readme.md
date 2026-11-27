# AWS Comprehend Redaction

This example uses `AWSComprehendRedactor` to remove PII from prompt text before it is sent to an AI endpoint. The prompt is stored in Jsonnet and the TypeScript entrypoint registers a `redactText` native callback.

The sample injects a mock Comprehend client so it can run locally without AWS credentials. In production, remove the injected `client` and provide `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION`.

```bash
npm install
npm run dev
```

The output shows direct prompt redaction and a wrapped chat endpoint receiving the protected prompt.
