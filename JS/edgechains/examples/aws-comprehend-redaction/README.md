# AWS Comprehend Redaction Example

This example redacts personally identifiable information with Amazon Comprehend before sending text to an LLM endpoint.

## Environment

Set AWS credentials with the standard environment variables:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_SESSION_TOKEN=...
```

`AWS_SESSION_TOKEN` is optional. `AWS_DEFAULT_REGION` is also supported when `AWS_REGION` is not set.

## Run

```bash
npm install
npm start
```
