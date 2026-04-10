# AWS Comprehend PII Redaction Example

Demonstrates how to chain `PiiRedactor` with EdgeChains endpoint classes to automatically redact sensitive information before sending prompts to LLMs.

## Setup

```bash
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret
export AWS_REGION=us-east-1  # optional, defaults to us-east-1
```

## Run

```bash
npm install
npm start
```

## Chaining Pattern

The `PiiRedactor` class supports a fluent pipeline API:

```typescript
import { PiiRedactor } from "@arakoodev/edgechains.js/ai";
import { OpenAI } from "@arakoodev/edgechains.js/ai";

const redactor = new PiiRedactor({ region: "us-east-1" });
const openai = new OpenAI({ apiKey: "..." });

// Chain: redact PII → send to LLM
const response = await redactor
  .pipe("My SSN is 123-45-6789, help me with taxes")
  .chain((result) => openai.chat({ prompt: result.redactedText }));

console.log(response.content);
// LLM receives: "My [REDACTED], help me with taxes"
```

### Mask Modes

- **fixed** (default): Replace with `[REDACTED]` or custom value
- **char**: Replace each character with a mask character (e.g., `***`)
- **label**: Replace with entity type label (e.g., `[SSN]`, `[PERSON]`)
