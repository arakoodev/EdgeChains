# AWS Comprehend Redaction Example

This example redacts PII from a prompt with AWS Comprehend before sending the prompt to an existing EdgeChains endpoint.

## Setup

Set credentials in your shell or `.env`:

```sh
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
OPENAI_API_KEY=...
```

The prompt is stored in `jsonnet/main.jsonnet`.

```sh
npm install
npm run start
```
