# AWS Comprehend PII Redaction Example

This example demonstrates how to chain `AWSComprehend` as an Observable (`PiiObservable`) with existing EdgeChains AI Endpoint classes (`OpenAI`, `GeminiAI`, `LlamaAI`) to detect and redact sensitive PII (`NAME`, `EMAIL`, `SSN`, `PHONE`, `CREDIT_DEBIT_NUMBER`, etc.) from prompts before sending them to an LLM.

## Installation

```bash
npm install
```

## Configuration

Copy `jsonnet/secrets.example.jsonnet` to `jsonnet/secrets.jsonnet` and configure your credentials:

```jsonnet
{
    "openai_api_key": "sk-...",
    "aws_region": "us-east-1",
    "aws_access_key_id": "AKIA...",
    "aws_secret_access_key": "..."
}
```

## Usage

1. Start the server:

```bash
npm run start
```

2. Send a `POST` request to `http://localhost:3000/redact-and-chat`:

```json
{
    "question": "Hi, my name is Jane Doe, my email is jane.doe@example.com, and my SSN is 123-45-6789. Can you check my order status?"
}
```

### Direct SDK Chaining Usage

```typescript
import { AWSComprehend, OpenAI, PiiObservable } from "@arakoodev/edgechains.js/ai";

const comprehend = new AWSComprehend({
    region: "us-east-1",
    maskMode: "REPLACE_WITH_PII_ENTITY_TYPE",
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 1. Observable pipeline chaining
const response = await PiiObservable.of("Contact John at john@example.com or 555-123-4567")
    .pipe(comprehend.asOperator())
    .switchMap((redactedPrompt) => openai.chat({ prompt: redactedPrompt }))
    .toPromise();

// 2. Endpoint proxy wrapper (automatically redacts prompts & chat messages)
const safeOpenAI = comprehend.wrapEndpoint(openai);
const reply = await safeOpenAI.chat({
    prompt: "My SSN is 123-45-6789, please help me reset my account.",
});
```
