# AWS Comprehend PII Redaction Example

This example uses Jsonnet to define a prompt and then calls the JavaScript SDK's AWS Comprehend PII redactor before the prompt is sent to another endpoint. The redactor calls AWS Comprehend directly through its REST API and replaces detected sensitive spans with typed placeholders.

## Setup

Set AWS credentials for an account that can call `comprehend:DetectPiiEntities`.

```bash
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
```

## Run

```bash
cd ../../arakoodev
npm install
npm run build
cd ../examples/aws-comprehend-pii-redaction
npm install
npm run start
```

You can override the sample prompt:

```bash
INPUT_PROMPT="Email Rahul at rahul@example.com" npm run start
```

For a local demo without AWS credentials, run the mocked flow:

```bash
MOCK_AWS_COMPREHEND=true npm run start
```
