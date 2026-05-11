# AWS Comprehend redaction

This example redacts PII from a prompt before it is sent to an AI endpoint.

It runs in mock mode by default, so reviewers can verify the chaining behavior without AWS credentials. Set `USE_REAL_AWS=1` with `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` to call Amazon Comprehend.

```bash
npm install
npm start
```

The example demonstrates both supported surfaces:

- `chain(prompt, endpoint)` for existing Promise-based endpoint classes.
- `redactObservable(source)` for Observable-compatible prompt streams.
