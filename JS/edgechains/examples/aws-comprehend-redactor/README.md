# AWS Comprehend PII Redactor — EdgeChains Example

Detects and redacts sensitive PII (names, emails, phone numbers, SSNs, credit card numbers)
from prompts using **AWS Comprehend `DetectPiiEntities`**, before they are sent to an LLM endpoint.

The redactor is chainable with existing EdgeChains endpoint classes:

- `redact(text, options)` — returns the sanitized prompt.
- `chain(endpointHandler, options)` — wraps an LLM call so it only ever sees redacted prompts.
- `asObservable(options)` — RxJS-compatible pipe operator for reactive pipelines.

No AWS SDK dependency: live calls use native SigV4 signing over REST. Tests and this demo run
fully offline through the injectable `mockCaller` hook.

## Installation

```bash
cd JS/edgechains/examples/aws-comprehend-redactor
npm install
```

## Running the demo

```bash
npm start
```

- **Offline (default):** without AWS credentials the demo uses a built-in mock detector — no network needed.
- **Live AWS:** export `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (and optionally `AWS_REGION`,
  `AWS_SESSION_TOKEN`) to call the real Comprehend API. Set `OPENAI_API_KEY` to forward the redacted
  prompt to a live OpenAI chat completion.

## Sample output

Input prompt:

```text
Hi, my name is John Doe. My email is john.doe@example.com, phone 555-123-4567, SSN 123-45-6789 and card 4111 1111 1111 1111. Please update my account.
```

Fully masked (each PII span replaced by `*` of the same length):

```text
Hi, my name is ********. My email is ********************, phone ************, SSN *********** and card *******************. Please update my account.
```

Label mode (`{ mode: "replace_label" }`):

```text
Hi, my name is [NAME]. My email is [EMAIL], phone [PHONE], SSN [SSN] and card [CREDIT_DEBIT_NUMBER]. Please update my account.
```

Selective redaction (`{ piiEntityTypes: ["SSN", "CREDIT_DEBIT_NUMBER"] }`):

```text
Hi, my name is John Doe. My email is john.doe@example.com, phone 555-123-4567, SSN *********** and card *******************. Please update my account.
```

The chained LLM endpoint receives only the sanitized prompt — raw PII never leaves your service.

## Usage

```ts
import { ComprehendRedactor } from "@arakoodev/edgechains.js/ai";
import { OpenAI } from "@arakoodev/edgechains.js/ai";

const redactor = new ComprehendRedactor({ region: "us-east-1" }); // reads AWS env credentials by default

// 1. Standalone redaction
const safePrompt = await redactor.redact("My SSN is 123-45-6789", { mode: "replace_label" });
// -> "My SSN is [SSN]"

// 2. Chain with an EdgeChains endpoint class
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const chat = redactor.chain((prompt: string) => openai.chat({ prompt }), {
    piiEntityTypes: ["EMAIL", "SSN", "CREDIT_DEBIT_NUMBER"],
});
await chat("Charge my card 4111 1111 1111 1111"); // OpenAI sees only the masked prompt

// 3. Reactive pipeline (rxjs-compatible operator)
// source$.pipe(redactor.asObservable({ maskChar: "#" }))
```

## Options

| Option             | Description                                                        | Default   |
| ------------------ | ------------------------------------------------------------------ | --------- |
| `piiEntityTypes`   | Only redact these Comprehend PII types; omit to redact all found   | all       |
| `maskChar`         | Character used to mask spans                                       | `*`       |
| `mode`             | `"mask"` or `"replace_label"` (`[ENTITY_TYPE]`)                    | `"mask"`  |
| `languageCode`     | BCP-47 code passed to Comprehend                                   | `"en"`    |
| `fallbackToOriginal` | Return original text instead of throwing when Comprehend fails   | `false`   |
