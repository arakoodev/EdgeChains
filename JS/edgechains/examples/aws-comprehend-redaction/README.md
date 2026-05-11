# AWS Comprehend prompt redaction

This example builds a prompt from jsonnet, sends it through `AwsComprehendRedactor`,
and prints the redacted prompt plus the PII entities Amazon Comprehend detected.

## Run

```sh
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...

bun install
bun run start
```

The prompt content is defined in `jsonnet/main.jsonnet`. You can override the sample
PII without editing code:

```sh
CUSTOMER_NAME="Jane Doe" \
CUSTOMER_EMAIL="jane@example.com" \
CUSTOMER_PHONE="555-010-1212" \
bun run start
```
