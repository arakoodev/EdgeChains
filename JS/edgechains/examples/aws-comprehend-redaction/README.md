# AWS Comprehend Redaction Example

This example shows how to redact PII from prompts before passing them to an EdgeChains-style endpoint.

## Run

1. Install dependencies from this folder with `npm install`.
2. Run `npm start`.
3. To call real AWS Comprehend, set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and optionally `AWS_REGION`; otherwise the example uses an offline mock client.

The example demonstrates direct prompt redaction and `chainEndpoint()` wrapping. In a local repository checkout, `npm start` also builds the local AWS Comprehend redactor export used by this example.

## Expected Output

```text
Original prompt:
Please summarize this support ticket from Jane Doe. Email: jane@example.com. Phone: 555-1212.

Redacted prompt:
Please summarize this support ticket from [NAME]. Email: [EMAIL]. Phone: [PHONE].

Endpoint response:
Endpoint received safe prompt: Please summarize this support ticket from [NAME]. Email: [EMAIL]. Phone: [PHONE].
```
