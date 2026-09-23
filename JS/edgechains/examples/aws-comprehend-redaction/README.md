# AWS Comprehend redaction example

This example shows how to redact PII before sending a prompt to an endpoint-style
chat client. It uses a mock Comprehend-compatible client so the example runs
without AWS credentials.

```bash
npm install
npm run build
npm start
```

Production callers can pass an AWS SDK v3 Comprehend client through
`AWSComprehendSdkAdapter`.
