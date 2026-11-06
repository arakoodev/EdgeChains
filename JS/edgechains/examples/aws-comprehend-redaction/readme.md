# AWS Comprehend PII Redaction with Observable Chaining

This example demonstrates how to use the **AWS Comprehend Redaction Utility** in EdgeChains to detect and redact Personally Identifiable Information (PII) from prompts and multi-turn chat messages before forwarding them to LLM Endpoint classes (`OpenAI`, `OpenAiEndpoint`, `GeminiAI`, `LlamaAI`).

It implements reactive RxJS Observable chaining via `ComprehendObservable` operators and `ComprehendRedactionChain`.

## Features

-   **Amazon Comprehend Real-time PII Detection**: Uses AWS Comprehend `DetectPiiEntities` API to identify sensitive entities (Names, Emails, Phones, SSNs, Credit Cards, Bank Accounts, Addresses, Dates, etc.).
-   **UTF-8 Byte Offset Alignment**: Accurately maps AWS Comprehend UTF-8 byte offsets to JavaScript UTF-16 character indices, handling emojis and international characters without misalignment.
-   **Multiple Redaction Modes**:
    -   `REPLACE_WITH_PII_ENTITY_TYPE` (Default): Replaces entities with their type tag (e.g. `[NAME]`, `[EMAIL]`, `[PHONE]`, `[SSN]`).
    -   `MASK`: Replaces entities with repeated mask characters (e.g. `***`).
    -   `CUSTOM`: Custom replacement string or callback function `(entity, original) => string`.
-   **Large Text Chunking**: Automatically splits texts exceeding AWS Comprehend's payload limit (>80 KB) on paragraph, sentence, or word boundaries and coalesces entity offsets.
-   **Endpoint Chaining**:
    -   `redactor.chain(endpoint, options)`: Directly executes endpoints with redacted prompts.
    -   `redactor.wrap(endpoint)`: Transparently wraps endpoints via Proxy to automatically redact all outgoing requests.
-   **RxJS Observable Pipeline**:
    -   `ComprehendObservable.redact(redactor)`: Reactive operator for stream-based prompt redaction.
    -   `ComprehendObservable.redactMessages(redactor)`: Reactive operator for chat message arrays.
    -   `ComprehendObservable.chainEndpoint(redactor, endpoint)`: Pipes prompt streams directly into LLM endpoint executions.
    -   `ComprehendRedactionChain`: Encapsulated high-level chain object with `.run()`, `.runObservable()`, and `.pipeObservable()`.

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
