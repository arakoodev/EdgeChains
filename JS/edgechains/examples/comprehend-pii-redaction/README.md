# EdgeChains AWS Comprehend PII Redaction Example (#290)

Demonstrates chaining `ComprehendPiiRedactor` and `RedactEndpoint` as an Observable pipeline with EdgeChains `OpenAI` endpoints so sensitive PII (`EMAIL`, `SSN`, `PHONE`, `CREDIT_DEBIT_NUMBER`, etc.) is redacted via AWS Comprehend before reaching the LLM.

## Usage

```bash
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export OPENAI_API_KEY=your_openai_key
npx ts-node src/index.ts
```
