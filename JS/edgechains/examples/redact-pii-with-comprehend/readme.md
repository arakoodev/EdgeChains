# Redact PII with Amazon Comprehend

A full working example of the `AwsComprehend` utility added for
[issue #290](https://github.com/arakoodev/EdgeChains/issues/290): prompts are
scanned with Amazon Comprehend's `DetectPiiEntities`, the detected spans are
redacted locally, and only the redacted prompt is sent to the LLM endpoint.

## What it does

1. Builds a prompt that contains a name, an email address and a card number.
2. Prints the entities Comprehend detects and the redacted prompt
   (`[NAME]`, `[EMAIL]`, `[CREDIT_DEBIT_NUMBER]`, ...).
3. Chains the redactor with the existing `OpenAI` Endpoint class via
   `comprehend.chain(openai)` and sends the (redacted) prompt through it.

## Setup

```bash
npm install
```

Set the environment variables:

| Variable                | Purpose                                             |
| ----------------------- | --------------------------------------------------- |
| `AWS_REGION`            | AWS region for Comprehend, e.g. `us-east-1`         |
| `AWS_ACCESS_KEY_ID`     | Credentials allowed to call `DetectPiiEntities`     |
| `AWS_SECRET_ACCESS_KEY` | Matching secret access key                          |
| `OPENAI_API_KEY`        | Used for the chat call made after redaction         |

## Run

```bash
npm start
```

Expected output (values vary):

```
Original prompt:  Hi, I am John Doe. Please email the invoice to john@example.com and charge my card 4111 1111 1111 1111 if the order ships late.
Detected PII:     NAME (0.99), EMAIL (0.99), CREDIT_DEBIT_NUMBER (0.98)
Redacted prompt:  Hi, I am [NAME]. Please email the invoice to [EMAIL] and charge my card [CREDIT_DEBIT_NUMBER] if the order ships late.
Model response:   ...
```

A Loom walkthrough of this example running end to end can be supplied on
request.
