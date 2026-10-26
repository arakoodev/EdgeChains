# AWS Comprehend PII Redaction Example (`@arakoodev/edgechains.js`)

Demonstrates how to detect and redact Personally Identifiable Information (PII) in prompts and conversation transcripts using `AWSComprehend` and chain it as an Observable (`PiiObservable`) with EdgeChains `OpenAI` / `GeminiAI` / `LlamaAI` endpoints.

## Features Demonstrated

1. **AWS Comprehend `DetectPiiEntities` & `ContainsPiiEntities`** with zero-dependency AWS Signature v4 (`AWS4-HMAC-SHA256`) request signing.
2. **Configurable Redaction Modes**:
    - `REPLACE_WITH_PII_ENTITY_TYPE` (`[NAME]`, `[SSN]`, `[EMAIL]`, `[PHONE]`)
    - `CHARACTER_MASK` (`***-**-****`)
    - `MASK` (`[REDACTED]` or `*****`)
3. **Observable Chaining (`PiiObservable`)**:
    - `comprehend.redactObservable(promptStream)`
    - `comprehend.chainWithEndpoint(openAI, { prompt })`
    - `comprehend.createRedactedEndpoint(openAI)`

## Running the Example

```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_REGION="us-east-1"
export OPENAI_API_KEY="sk-..."

npm install
npm start
```
