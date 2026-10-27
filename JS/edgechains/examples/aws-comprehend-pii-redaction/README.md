# AWS Comprehend PII Redaction Example (`@arakoodev/edgechains.js`)

Demonstrates chaining `ComprehendPiiRedactor` with `OpenAI` (or any EdgeChains Endpoint class) as an Observable so sensitive PII (`NAME`, `EMAIL`, `PHONE`, `SSN`, `CREDIT_DEBIT_NUMBER`, `ADDRESS`) is automatically redacted before prompts or chat transcripts are sent to the LLM.

## Run

```bash
export AWS_REGION="us-east-1"
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export OPENAI_API_KEY="..."
npm start
```
