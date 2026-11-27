# AWS Comprehend PII Redaction Example

Demonstrates chaining `AwsComprehendRedactor` with `OpenAI` from `@arakoodev/edgechains.js/ai` using RxJS observables so PII is stripped before prompts leave your environment.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Export AWS and OpenAI credentials:
   ```bash
   export AWS_REGION=us-east-1
   export AWS_ACCESS_KEY_ID=...
   export AWS_SECRET_ACCESS_KEY=...
   export OPENAI_API_KEY=...
   ```
3. Run the example:
   ```bash
   npm start
   ```
