# AWS Comprehend PII redaction

Redact personally identifiable information from prompts and conversation transcripts with Amazon Comprehend, then chain the sanitized text into an existing EdgeChains LLM endpoint.

The current JS SDK (`OpenAI`, `GeminiAI`, `LlamaAI`) is Promise-based, not RxJS. This example keeps prompts in Jsonnet (same as `chat-with-llm`) and chains redaction in TypeScript:

```ts
const chained = comprehend.chain(openai);
await chained.chat({ prompt });
```

or

```ts
await pipe(prompt, comprehend.asOperator(), (safe) => openai.chat({ prompt: safe }));
```

Implementation follows the two issue links:

- [Detecting and redacting PII using Amazon Comprehend](https://aws.amazon.com/blogs/machine-learning/detecting-and-redacting-pii-using-amazon-comprehend/) — `ContainsPiiEntities` preflight, `DetectPiiEntities` offsets, then local `REPLACE_WITH_PII_ENTITY_TYPE` / `MASK` redaction.
- [How to redact PII data in conversation transcripts](https://aws.amazon.com/blogs/machine-learning/how-to-redact-pii-data-in-conversation-transcripts/) — `redactTranscript()` for Agent/Caller turns.

## Installation

```bash
cd ../../arakoodev && npm install && npm run build
cd ../examples/aws-comprehend-pii-redaction && npm install
```

## Configuration

Edit `jsonnet/secrets.jsonnet` to use a real Comprehend account and/or OpenAI key:

```
local OPENAI_API_KEY = "sk-****";
local AWS_REGION = "us-east-1";
local AWS_ACCESS_KEY_ID = "AKIA...";
local AWS_SECRET_ACCESS_KEY = "...";
```

If AWS keys are left empty, the example uses a local demo detector so you can still run the chain. Set `COMPREHEND_DEMO=1` to force that path even when keys are present.

## Usage

Credential-free demo of the two-pass API, `chain()`, `pipe()`, MASK mode, and the AWS blog conversation transcript:

```bash
npm run demo
```

HTTP server (Jsonnet prompt + TypeScript `AWSComprehend.chain(openai)`):

```bash
COMPREHEND_DEMO=1 npm start
```

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"Hi, I am Alice Johnson. Email me at alice@example.com. SSN 078-05-1120."}'
```

Redaction only (optional `"maskMode": "MASK"`):

```bash
curl -X POST http://localhost:3000/redact \
  -H "Content-Type: application/json" \
  -d '{"text":"Call Jane Smith at 415-555-0199"}'
```

Conversation transcript:

```bash
curl -X POST http://localhost:3000/transcript \
  -H "Content-Type: application/json" \
  -d '{"turns":[{"speaker":"Caller","text":"Hello, my name is John Stiles."}]}'
```

## TypeScript chaining

```ts
import { AWSComprehend, OpenAI, pipe } from "@arakoodev/edgechains.js/ai";

const comprehend = new AWSComprehend({ region: "us-east-1" });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const chained = comprehend.chain(openai);
const response = await chained.chat({
    prompt: "My name is John Smith, SSN 123-45-6789",
});

const piped = await pipe(
    "My name is John Smith, SSN 123-45-6789",
    comprehend.asOperator(),
    (prompt) => openai.chat({ prompt })
);
```
