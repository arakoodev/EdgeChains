# AWS Comprehend PII Redactor Example (EdgeChains.js)

This example demonstrates how to integrate **Amazon Comprehend** with EdgeChains to automatically detect and redact Personally Identifiable Information (PII) before passing prompts to LLMs (OpenAI, Gemini, Llama, etc.).

## Key Features

1. **High-Accuracy PII Detection**: Uses AWS Comprehend `DetectPiiEntities` API.
2. **Flexible Masking Modes**:
   - `redact_label`: Replaces entities with their type tag (e.g. `[EMAIL]`, `[PHONE]`, `[SSN]`, `[NAME]`).
   - `placeholder`: Replaces all entities with a custom placeholder (e.g. `[REDACTED]`).
   - `mask`: Masks characters with asterisks `****`.
3. **Endpoint Chaining**: Automatically wraps and intercepts `Endpoint.chat()` calls to sanitize `prompt` and conversation `messages` transparently.

## Quick Start

### 1. Configure AWS Credentials (Optional)

Create a `.env` file or export your AWS credentials:
```bash
export AWS_REGION="us-east-1"
export AWS_ACCESS_KEY_ID="your_access_key"
export AWS_SECRET_ACCESS_KEY="your_secret_key"
```

*(If credentials are not set, the example includes graceful fallback behavior for local testing).*

### 2. Install and Run

```bash
pnpm install
pnpm start
```

## Example Usage in Code

```typescript
import { AWSComprehendRedactor } from "@arakoodev/edgechains.js/ai";
import { OpenAI } from "@arakoodev/edgechains.js/ai";

const redactor = new AWSComprehendRedactor({
    region: "us-east-1",
    maskMode: "redact_label",
    confidenceThreshold: 0.8
});

// Direct redaction
const result = await redactor.redact("My email is alice@example.com");
console.log(result.redactedText); // "My email is [EMAIL]"

// Chaining with LLM Endpoint
const openAi = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const securedOpenAi = redactor.chain(openAi);

// Prompts are automatically sanitized before hitting OpenAI!
const response = await securedOpenAi.chat({
    prompt: "My SSN is 000-11-2222, what is my credit score?"
});
```
