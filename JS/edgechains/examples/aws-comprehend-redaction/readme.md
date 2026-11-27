# AWS Comprehend redaction example

This example shows how to redact PII from prompts before they are sent to an endpoint-style chat class.

Run the local demo without AWS credentials:

```bash
npm install
npm start
```

The demo uses a mock Comprehend client so it is deterministic. To make a live AWS Comprehend request, set `USE_LIVE_AWS_COMPREHEND=true` along with `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION`.
