# AWS Comprehend PII Redaction Example

Demonstrates chaining `AwsComprehendRedactor` as an Observable with EdgeChains AI Endpoints (`OpenAI`, `GeminiAI`, `LlamaAI`) to detect and redact sensitive PII (`NAME`, `EMAIL`, `PHONE`, `SSN`, `CREDIT_DEBIT_NUMBER`, etc.) before prompts are sent to an LLM.

## Configuration

Update `jsonnet/secrets.jsonnet` (or environment variables `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, and `OPENAI_API_KEY`):

```jsonnet
local OPENAI_API_KEY = "sk-proj-***";
local AWS_ACCESS_KEY_ID = "AKIA***";
local AWS_SECRET_ACCESS_KEY = "***";
local AWS_REGION = "us-east-1";
```

## Usage

1. Install dependencies and start the server:

```bash
npm install
npm run start
```

2. Send a `POST` request to `http://localhost:3000/redact-chat`:

```bash
curl -X POST http://localhost:3000/redact-chat \
  -H "Content-Type: application/json" \
  -d '{"transcript": "Hi, I am Jane Doe (jane@example.com, SSN 123-45-6789) and I need help with my billing inquiry."}'
```
