# AWS Comprehend PII Redaction Example

This example demonstrates how to use `AWSComprehend` and `RedactionObservable` from `@arakoodev/edgechains.js/ai` to detect and redact sensitive PII (Personally Identifiable Information) in prompts before sending them to an LLM Endpoint (`OpenAI`, `GeminiAI`, `LlamaAI`).

## Key Features Demonstrated

1. **Lightweight SigV4 REST Integration**: Direct AWS Comprehend REST communication without heavy external AWS SDK dependencies.
2. **Endpoint Chaining**: Automatically redacts sensitive information like names, phone numbers, and emails before dispatching to `OpenAI.chat(...)`.
3. **Reactive Observable Pipeline**: Compose prompt redaction via `RedactionObservable` and `.pipe(comprehend.asOperator())`.

## Setup & Running

1. Configure environment variables:
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
