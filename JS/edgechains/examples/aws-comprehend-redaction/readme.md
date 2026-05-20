# AWS Comprehend Redaction

This example redacts PII from a Jsonnet-managed prompt with `AwsComprehendRedactor`
before sending the sanitized prompt to an `OpenAI` endpoint.

Required environment variables:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `OPENAI_API_KEY`

Run the example server:

```sh
npm install
npm run build
npm start
```
