# AWS Comprehend PII redaction

This example redacts PII before an endpoint receives a prompt. It runs offline by default and uses
the real Amazon Comprehend client when `USE_REAL_AWS=true`.

```sh
npm install
npm run demo
```

Expected output:

```text
Original: 🔒 Contact jane@example.com before sharing this prompt.
Endpoint received: 🔒 Contact [EMAIL] before sharing this prompt.
```

For a live run, provide AWS credentials through the standard AWS credential provider chain and set
`USE_REAL_AWS=true AWS_REGION=us-east-1`. Never put AWS keys in this repository.

## Loom checklist

1. Show issue #290 and its completion criteria.
2. Run the offline demo and focused test file.
3. Show the RxJS endpoint chain and cancellation test.
4. Upload the recording to Loom and add its URL to the pull request.
