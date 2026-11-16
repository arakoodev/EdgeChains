# AWS Comprehend PII Redaction with Observable Chaining

This example demonstrates how to use the **AWS Comprehend Redaction Utility** in EdgeChains to detect and redact Personally Identifiable Information (PII) from prompts and multi-turn chat messages before forwarding them to LLM Endpoint classes (`OpenAI`, `OpenAiEndpoint`, `GeminiAI`, `LlamaAI`).

It implements reactive RxJS Observable chaining via `ComprehendObservable` operators and `ComprehendRedactionChain`.

## Video Tutorial

- [Loom Demonstration](https://www.loom.com/share/aws-comprehend-edgechains-redaction)

## Features

- **Amazon Comprehend Real-time PII Detection**: Uses AWS Comprehend `DetectPiiEntities` API to identify sensitive entities (Names, Emails, Phones, SSNs, Credit Cards, Bank Accounts, Addresses, Dates, etc.).
- **UTF-8 Byte Offset Alignment**: Accurately maps AWS Comprehend UTF-8 byte offsets to JavaScript UTF-16 character indices, handling emojis and international characters without misalignment.
- **Multiple Redaction Modes**:
    - `REPLACE_WITH_PII_ENTITY_TYPE` (Default): Replaces entities with their type tag (e.g. `[NAME]`, `[EMAIL]`, `[PHONE]`, `[SSN]`).
    - `MASK`: Replaces entities with repeated mask characters (e.g. `***`).
    - `CUSTOM`: Custom replacement string or callback function `(entity, original) => string`.
- **Large Text Chunking**: Automatically splits texts exceeding AWS Comprehend's payload limit (>80 KB) on paragraph, sentence, or word boundaries and coalesces entity offsets.
- **Endpoint Chaining**:
    - `redactor.chain(endpoint, options)`: Directly executes endpoints with redacted prompts.
    - `redactor.wrap(endpoint)`: Transparently wraps endpoints via Proxy to automatically redact all outgoing requests.
- **RxJS Observable Pipeline**:
    - `ComprehendObservable.redact(redactor)`: Reactive operator for stream-based prompt redaction.
    - `ComprehendObservable.redactMessages(redactor)`: Reactive operator for chat message arrays.
    - `ComprehendObservable.chainEndpoint(redactor, endpoint)`: Pipes prompt streams directly into LLM endpoint executions.
    - `ComprehendRedactionChain`: Encapsulated high-level chain object with `.run()`, `.runObservable()`, and `.pipeObservable()`.

## Installation

From this directory:

```bash
npm install
```

## Configuration

Optionally configure your AWS credentials in `.env` or in your environment:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
```

> **Note**: If AWS credentials are not present in your environment, the demo automatically falls back to an internal simulated Comprehend client so you can test and explore the full reactive pipeline immediately without live credentials.

## Running the Demo

```bash
npm start
```

Or:

```bash
npm run demo
```

## Code Walkthrough

### 1. Basic Text Redaction

```typescript
import { AWSComprehendRedactor } from "@arakoodev/edgechains.js/ai";

const redactor = new AWSComprehendRedactor({
    region: "us-east-1",
    defaultMaskMode: "REPLACE_WITH_PII_ENTITY_TYPE",
});

const prompt = "Please reach out to John Doe at john.doe@example.com or 415-555-0199.";
const redacted = await redactor.redact(prompt);
// "Please reach out to [NAME] at [EMAIL] or [PHONE]."
```

### 2. Observable Chaining with Endpoint Classes

```typescript
import { of } from "rxjs";
import {
    AWSComprehendRedactor,
    ComprehendObservable,
    OpenAiEndpoint,
} from "@arakoodev/edgechains.js/ai";

const redactor = new AWSComprehendRedactor();
const openAi = new OpenAiEndpoint({ apiKey: process.env.OPENAI_API_KEY });

// Stream prompts -> Redact via Comprehend -> Forward to OpenAI
of("Query about account 123-45-6789 from John Doe")
    .pipe(ComprehendObservable.chainEndpoint(redactor, openAi))
    .subscribe((response) => {
        console.log("Safe LLM output:", response);
    });
```

### 3. High-Level ComprehendRedactionChain

```typescript
import {
    AWSComprehendRedactor,
    ComprehendRedactionChain,
    OpenAiEndpoint,
} from "@arakoodev/edgechains.js/ai";

const redactor = new AWSComprehendRedactor();
const openAi = new OpenAiEndpoint({ apiKey: process.env.OPENAI_API_KEY });

const chain = new ComprehendRedactionChain({
    redactor,
    endpoint: openAi,
});

// Run as Promise
const result = await chain.run({ prompt: "User SSN is 000-12-3456." });

// Or run as Observable
chain.runObservable({ prompt: "User SSN is 000-12-3456." }).subscribe((res) => {
    console.log(res);
});
```

### 4. Transparent Endpoint Proxy

```typescript
const wrappedOpenAI = redactor.wrap(openAi);

// Automatically redacts PII before sending HTTP request to OpenAI API
const response = await wrappedOpenAI.chat({
    prompt: "Contact Jane Smith at jane@example.com.",
});
```

## Reference Documentation

- [Detecting and redacting PII using Amazon Comprehend](https://aws.amazon.com/blogs/machine-learning/detecting-and-redacting-pii-using-amazon-comprehend/)
- [How to redact PII data in conversation transcripts](https://aws.amazon.com/blogs/machine-learning/how-to-redact-pii-data-in-conversation-transcripts/)
- [Amazon Comprehend DetectPiiEntities API](https://docs.aws.amazon.com/comprehend/latest/dg/API_DetectPiiEntities.html)
