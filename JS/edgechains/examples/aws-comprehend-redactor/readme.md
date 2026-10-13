# AWS Comprehend PII Redactor Chaining Example

This example demonstrates how to integrate and chain AWS Comprehend PII redaction with EdgeChains AI endpoints (such as `OpenAI`, `GeminiAI`, or `LlamaAI`).

## Features Demonstrated

1. **Standalone Redaction**: Detect and mask sensitive entities (SSN, Email, Phone, Credit Card) from prompts.
2. **Endpoint Chaining**: Automatically sanitize prompts and chat message arrays before dispatching to downstream LLM endpoints via `.chain()`.
3. **Reactive Observable Streams**: Stream and transform prompts reactively using `SimpleObservable` and `.observeAndChat()`.
4. **AWS SDK v3 Compatibility**: Full support for `@aws-sdk/client-comprehend` commands via the `commandFactory` configuration option.

## Quick Start

### 1. Build and Run Demo

From the example directory:

```bash
npm run start
```

### 2. Using with Real AWS Comprehend

Install the AWS Comprehend client:

```bash
npm install @aws-sdk/client-comprehend
```

Configure your redactor with credentials:

```typescript
import { ComprehendClient, DetectPiiEntitiesCommand } from "@aws-sdk/client-comprehend";
import { ComprehendRedactor, OpenAI } from "@arakoodev/edgechains.js/ai";

const comprehendClient = new ComprehendClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

const redactor = new ComprehendRedactor({
    client: comprehendClient,
    commandFactory: (input) => new DetectPiiEntitiesCommand(input),
    languageCode: "en",
    minScore: 0.8,
    replacement: (entity) => `[REDACTED_${entity.Type}]`,
});

// Chain with OpenAI Endpoint
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const secureChat = redactor.chain(openai);

// Prompt will be sanitized before being sent to OpenAI
const reply = await secureChat.chat({
    prompt: "Customer SSN is 000-11-2222. Please draft account confirmation.",
});
console.log(reply);
```
