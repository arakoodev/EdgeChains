# PII redaction with Amazon Comprehend

This example shows how to redact personally identifiable information (PII)
from prompts with the `aws-comprehend` module of the EdgeChains JavaScript SDK
before the prompts reach an LLM endpoint.

It demonstrates the three acceptance points of the utility:

- `ComprehendPiiRedactor` wraps the Amazon Comprehend `DetectPiiEntities` API
  and masks detected entities such as names, phone numbers, emails, social
  security numbers, addresses and credit card numbers.
- `RedactionObservable` is an rxjs `Observable<string>` that can be chained
  with the SDK endpoint classes. Here it feeds redacted prompts into the
  `OpenAI` endpoint class; a single `mergeMap` keeps the whole pipeline in
  the observable world.
- Documents larger than the synchronous API limit are transparently split
  into chunks, and offsets are rewritten to document coordinates.

## Run it

```bash
cd JS/edgechains/arakoodev
npm install
npm run build

cd ../examples/pii-redaction-aws-comprehend
npm install
npm start
```

The example runs in two modes:

- With `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` set (plus optionally
  `AWS_REGION` and `OPENAI_API_KEY`), it calls the real Amazon Comprehend
  and OpenAI APIs.
- Without credentials, the redaction chain runs against a bundled local
  detector that mirrors the `DetectPiiEntities` response format, so the full
  pipeline can be demonstrated offline.

## Reference

- Detecting and redacting PII using Amazon Comprehend:
  https://aws.amazon.com/blogs/machine-learning/detecting-and-redacting-pii-using-amazon-comprehend/
- Redacting PII data in conversation transcripts:
  https://aws.amazon.com/blogs/machine-learning/how-to-redact-pii-data-in-conversation-transcripts/
