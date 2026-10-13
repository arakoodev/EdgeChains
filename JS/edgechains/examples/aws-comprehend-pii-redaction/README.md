# AWS Comprehend PII redaction example

Demonstrates `AWSComprehendPiiRedactor` from `@arakoodev/edgechains.js/ai` (bounty [#290](https://github.com/arakoodev/EdgeChains/issues/290)):

1. Detect PII with Amazon Comprehend `DetectPiiEntities`
2. Redact before sending prompts to an LLM Endpoint (`wrapEndpoint` / `chain` / `redact$`)

## Setup

```bash
# from JS/edgechains/arakoodev
npm install
npm run build

# from this example folder
cd ../examples/aws-comprehend-pii-redaction
npm install
```

## Run (mock — default, no AWS credentials)

```bash
npm run start:mock
```

Uses an injectable fake Comprehend client so CI / Loom demos work offline.

## Run (live AWS)

```bash
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
# optional:
export OPENAI_API_KEY=...
npm run start:live
```

IAM needs at least `comprehend:DetectPiiEntities`.

## Loom demo

**Loom URL:** _TODO — user must attach a Loom.com recording of this example + unit tests. See PR notes._

Suggested Loom outline (3–5 min):

1. Show issue #290 acceptance criteria
2. Run `npx vitest run src/ai/src/tests/comprehendPiiRedactor.test.ts` (all green)
3. Run `npm run start:mock` and show raw → redacted → wrapEndpoint
4. Brief code walkthrough of `AWSComprehendPiiRedactor`
