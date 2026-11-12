# PII redaction with AWS Comprehend (EdgeChains JS SDK)

This example demonstrates the `ComprehendRedactor` and `PiiRedactEndpoint` classes added to
`@arakoodev/edgechains.js/ai`. They detect and redact PII entities (EMAIL, SSN, PHONE,
CREDIT_DEBIT_NUMBER, NAME, ADDRESS, URL, DATE, ...) in prompts **before** they are dispatched to an
LLM endpoint, and chain with any EdgeChains endpoint class (`OpenAI`, `GeminiAI`, `LlamaAI`) as
reactive observables (`subscribe()` events + a `pipe()` `TransformStream` for stream-based chaining).

- Live mode calls AWS Comprehend `DetectPiiEntities` / `ContainsPiiEntities` (SigV4-signed, no extra SDK dependency).
- `mode: "offline"` uses deterministic local detection so the example and the unit tests run without AWS credentials.
- Redaction masks are configurable: default `[REDACTED_{TYPE}]`, custom templates (`maskTemplate`) and per-type overrides (`masks`, e.g. `{ SSN: "[REDACTED_SSN]" }`).

## Prerequisites

- Node.js 18 or newer.

## Step-by-step

1. Build the SDK once (required because the example consumes it through its `exports` map):

    ```bash
    cd ../../arakoodev
    npm install
    npx tsc -b
    ```

2. Install and run the example:

    ```bash
    cd ../examples/pii-redaction
    npm install
    npm start
    ```

Expected output (offline mode, no credentials needed):

```text
--- original ---
Customer Mr. John Smith reported a login problem. Reach him at john.smith@example.com or 555-123-4567, SSN 123-45-6789, card 4111 1111 1111 1111, billing address 42 Baker Street.

--- redacted ---
Customer [REDACTED_NAME] reported a login problem. Reach him at [REDACTED_EMAIL] or [REDACTED_PHONE], SSN [REDACTED_SSN], card [REDACTED_CREDIT_DEBIT_NUMBER], billing address [REDACTED_ADDRESS]

detected entities: NAME@9-23, EMAIL@63-85, PHONE@89-101, SSN@107-118, CREDIT_DEBIT_NUMBER@125-144, ADDRESS@162-178
observed 6 PII entity(ies), dispatched prompt is free of them

--- chained endpoint ---
[llm answered] Customer [REDACTED_NAME] reported a login problem. Reach him...
```

## Optional: live AWS Comprehend

Export credentials and re-run `npm start` — step 3 of the example then calls the real service:

```bash
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
npm start
```

The IAM principal needs `comprehend:DetectPiiEntities` and `comprehend:ContainsPiiEntities`
(the managed policy `arn:aws:iam::aws:policy/ComprehendReadOnly` is enough).

## Optional: live OpenAI behind the redacting endpoint

```bash
export OPENAI_API_KEY=sk-...
npm start
```

The prompt is PII-redacted by the endpoint before the OpenAI call, so the model never sees the raw
email/SSN/card number.

## Unit tests

From `JS/edgechains/arakoodev`:

```bash
npx vitest run src/ai/src/tests/comprehend.test.ts
```

13 deterministic tests cover transcript redaction, custom masks, empty/no-PII/multiple-entity edge
cases, confidence and entity-type filters, offset/overlap handling, observable chaining and stream piping.
