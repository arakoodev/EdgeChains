# AWS Comprehend PII Redaction + EdgeChains Endpoint Chaining Example

Demonstrates how to chain `AWSComprehend` (`ComprehendPiiRedactor`) and `RedactionObservable` with EdgeChains LLM Endpoint classes (`OpenAI`, `GeminiAI`, `LlamaAI`) to automatically detect and redact PII entities (`EMAIL`, `PHONE`, `SSN`, `NAME`, `CREDIT_DEBIT_NUMBER`, etc.) before sending prompts or conversation transcripts to an LLM.

## Usage

```bash
export AWS_REGION="us-east-1"
export AWS_ACCESS_KEY_ID="your-aws-access-key-id"
export AWS_SECRET_ACCESS_KEY="your-aws-secret-access-key"
export OPENAI_API_KEY="your-openai-api-key"

npm start
```
