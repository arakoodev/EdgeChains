# PII Redaction Chat Example (EdgeChains JS SDK)

Chains Amazon Comprehend PII redaction with an LLM endpoint (observables):

```
prompt$ (Subject) -> ComprehendRedactor.redactStream() -> OpenAI.chat()
```

1. `export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=...` and fill `src/jsonnet/secrets.jsonnet`
2. `npm install && npm run dev`
3. `curl "http://localhost:3000/?text=My%20name%20is%20Alice,%20phone%20+12065550100"` - PII is redacted before it ever reaches the LLM.

Demo video: (loom link to be attached after recording)
