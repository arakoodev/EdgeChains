# Redact PII with AWS Comprehend

This example shows how to use the `Comprehend` utility to redact sensitive
information (PII) from prompts before they reach an LLM endpoint. The redactor
**chains** with the existing Endpoint classes (`OpenAI`, `GeminiAI`, ...) so the
endpoint only ever observes the redacted prompt.

## Video

<!-- Loom walkthrough -->
https://www.loom.com/share/your-video-id

## Installation

1. Install the required dependencies:

    ```bash
    npm install
    ```

## Configuration

Provide your AWS credentials (used to call [Amazon Comprehend
`DetectPiiEntities`](https://docs.aws.amazon.com/comprehend/latest/APIReference/API_DetectPiiEntities.html))
and your OpenAI key as environment variables:

```bash
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REGION="us-east-1"
export OPENAI_API_KEY="sk-..."
```

## Usage

```bash
npm run start
```

Expected output for the sample prompt:

```
Original : Hi, my name is John Doe, my email is john.doe@example.com and my SSN is 123-45-6789.
Redacted : Hi, my name is [NAME], my email is [EMAIL] and my SSN is [SSN].
Masked   : Hi, my name is ********, my email is ******************** and my SSN is ***********.
```

## How it works

```ts
import { Comprehend, OpenAI } from "@arakoodev/edgechains.js/ai";

const comprehend = new Comprehend({ region: "us-east-1" });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// redact a prompt directly
const safe = await comprehend.redact({ text: "my email is john@example.com" });

// or chain the redactor in front of any Endpoint class
const response = await comprehend.pipe(openai).chat({ prompt: userPrompt });
```
