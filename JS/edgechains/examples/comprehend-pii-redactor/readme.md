# Comprehend PII Redactor Example

This example demonstrates how to use the `ComprehendRedactor` utility from
`@arakoodev/edgechains.js` to detect and redact PII (names, emails, phone
numbers, credit cards, SSNs, ...) from text using **Amazon Comprehend**.

The redactor is designed to be **chained** in front of the existing EdgeChains
`Endpoint` classes (e.g. `OpenAI`) so that prompts are scrubbed of sensitive
information before they ever leave your process.

## Installation

```bash
npm install
```

## Configuration

Configure your AWS credentials using any of the standard AWS provider chain
methods:

- Environment variables: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- Shared config/credentials files (`~/.aws/credentials`)
- An attached IAM role (when running on EC2/Lambda/ECS)

## Usage

```bash
npm run start
```

The example redacts PII from a few sample strings and prints the detected
entities alongside the redacted output.

## Chaining with an LLM Endpoint

```ts
import { ComprehendRedactor, OpenAI } from "@arakoodev/edgechains.js";

const redactor = new ComprehendRedactor({ region: "us-east-1" });
const llm = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const userPrompt = "My name is John Doe and my email is john@example.com";

// Scrub PII before sending the prompt to the LLM.
const { redactedText } = await redactor.redact(userPrompt);
const response = await llm.chat({ prompt: redactedText });

console.log(response.content);
```

## Options

`redact(text, options)` accepts:

- `replacement` — token used to replace each entity (default `"[REDACTED]"`).
- `entityTypes` — restrict redaction to a subset of PII types (e.g. `["EMAIL", "PHONE"]`).
- `language` — language of the input text (default `LanguageCode.EN`).