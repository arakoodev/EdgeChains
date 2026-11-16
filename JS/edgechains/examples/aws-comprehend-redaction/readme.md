# AWS Comprehend PII redaction

Redact personally identifiable information from prompts with Amazon Comprehend, then chain the sanitized prompt into an existing EdgeChains LLM endpoint.

This example keeps prompts in Jsonnet (same as `chat-with-llm`) and chains redaction in TypeScript: `AWSComprehend.chain(openai)` wraps `OpenAI.chat()` so PII is removed before the model call. The JS SDK is Promise-based (not RxJS); `pipe()` composes those async steps.

Redaction modes match the [Amazon Comprehend PII redaction](https://aws.amazon.com/blogs/machine-learning/detecting-and-redacting-pii-using-amazon-comprehend/) patterns:

- `REPLACE_WITH_PII_ENTITY_TYPE` (default) — `John Smith` becomes `[NAME]`
- `MASK` — `John Smith` becomes `**********`

## Installation

```bash
npm install
```

Build the local `@arakoodev/edgechains.js` package first if you are running from this repo:

```bash
cd ../../arakoodev && npm install && npm run build
cd ../examples/aws-comprehend-redaction && npm install
```

## Configuration

Edit `jsonnet/secrets.jsonnet`:

```
local OPENAI_API_KEY = "sk-****";
local AWS_REGION = "us-east-1";
local AWS_ACCESS_KEY_ID = "AKIA...";
local AWS_SECRET_ACCESS_KEY = "...";
```

If AWS keys are left as placeholders, the example uses a local demo detector so you can still run the chain. Set `COMPREHEND_DEMO=1` to force that path even when keys are present.

## Usage

Credential-free demo of detection, redaction, `chain()`, and `pipe()`:

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

Redaction only:

```bash
curl -X POST http://localhost:3000/redact \
  -H "Content-Type: application/json" \
  -d '{"text":"Call Jane Smith at 415-555-0199"}'
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
