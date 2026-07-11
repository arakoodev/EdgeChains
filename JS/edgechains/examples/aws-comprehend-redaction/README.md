# AWS Comprehend PII redaction example

This example demonstrates an RxJS pipeline that redacts PII before an endpoint receives a prompt.
It uses a deterministic offline client by default, so CI and reviewers do not need AWS credentials.

## Run the offline example

Build the local SDK first:

```bash
cd ../../arakoodev
npm install
npm run build

cd ../examples/aws-comprehend-redaction
npm install
npm run demo
```

Expected output:

```text
Original: 🔒 Please contact jane@example.com or call 555-010-1234.
Endpoint received: 🔒 Please contact [EMAIL] or call [PHONE].
```

## Run against Amazon Comprehend

The caller needs `comprehend:DetectPiiEntities`. Credentials are loaded through the standard AWS
SDK credential provider chain; do not put access keys in source code.

```bash
export AWS_REGION=us-east-1
export USE_REAL_AWS=true
npm run demo
```

Amazon Comprehend PII detection supports English (`en`) and Spanish (`es`) input and accepts up
to 100 KiB of UTF-8 text per real-time request. The example includes an emoji before the PII to
demonstrate correct Unicode code-point offset handling.

## Observable chain

```ts
const response$ = of({ prompt }).pipe(redactor.endpointOperator(endpoint));
```

`endpointOperator` preserves input order, propagates errors through RxJS, waits for redaction before
completion, and aborts the Comprehend request when the subscription is cancelled.
