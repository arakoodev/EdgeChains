# AWS Comprehend PII Redaction Example

This example demonstrates how to use `AWSComprehend` and `RedactionObservable` from `@arakoodev/edgechains.js/ai` to detect and redact sensitive PII (Personally Identifiable Information) in prompts before sending them to an LLM Endpoint (`OpenAI`, `GeminiAI`, `LlamaAI`).

## Setup

1. Configure your environment variables:
   ```bash
   export AWS_REGION="us-east-1"
   export AWS_ACCESS_KEY_ID="your-access-key-id"
   export AWS_SECRET_ACCESS_KEY="your-secret-access-key"
   export OPENAI_API_KEY="your-openai-api-key"
   ```

2. Build and run:
   ```bash
   npm install
   npm run build
   npm start
   ```
