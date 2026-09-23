# PII Redactor Example

This example demonstrates how to use `ComprehendPiiRedactor` to detect and redact personally identifiable information (PII) from text prompts before sending them to an LLM.

## Prerequisites

- AWS credentials with Comprehend access
- Node.js 18+

## Setup

```bash
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export AWS_REGION=us-east-1

npm install
npm start
```

## What it demonstrates

1. **Detect PII entities** - Find names, emails, SSNs, etc. in text
2. **Redact PII** - Replace sensitive data with placeholders
3. **Chain with LLM** - Safely process prompts before sending to OpenAI
4. **Filter entity types** - Choose which PII types to redact
