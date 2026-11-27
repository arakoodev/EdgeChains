# AWS Comprehend Redaction Example

This example redacts PII from a prompt with AWS Comprehend before the prompt is passed into a Jsonnet prompt template.

## Setup

```bash
npm install
AWS_REGION=us-east-1 npm start
```

AWS credentials should be configured through the normal AWS SDK provider chain, such as environment variables, an AWS profile, or an attached role.
