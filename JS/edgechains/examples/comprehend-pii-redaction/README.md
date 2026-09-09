# AWS Comprehend PII Redaction

This example loads a prompt from Jsonnet, redacts sensitive values with
`ComprehendPiiRedactor`, and prints the safe prompt.

```bash
npm install
npm run build
npm start
```

By default it uses a mock Comprehend client so the example can run without AWS
credentials. To call AWS Comprehend directly:

```bash
export AWS_REGION="us-east-1"
export USE_REAL_AWS="true"
npm start -- "Jane Doe emailed jane@example.com about invoice 555-010-9999."
```
