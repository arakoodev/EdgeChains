# AWS Comprehend PII Redaction

This example redacts PII from a prompt before sending it to an LLM endpoint.

## Setup

```sh
pnpm install
AWS_REGION=us-east-1 OPENAI_API_KEY=... OPENAI_ORG_ID=... pnpm start
```

The AWS credentials are loaded through the standard AWS SDK credential chain.
