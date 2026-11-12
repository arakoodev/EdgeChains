# AWS Comprehend PII Redaction (`#290`)

Demonstrates PII detection, classification, and redaction using `ComprehendPiiRedactor` chained with EdgeChains `Endpoint` classes as RxJS Observables.

## Key Features
- `detectPiiEntities` & `containsPiiEntities` support
- Configurable `confidenceThreshold`, `entityTypes`, and mask modes (`ENTITY_TYPE`, `MASK_CHAR`, `FIXED_MASK`)
- Automatic UTF-8 byte-safe chunking for prompts exceeding AWS Comprehend's 100 KB (`100,000` UTF-8 bytes) limit
- RxJS Observable operators (`redact$`, `redactOperator`, `endpointOperator`) with `AbortSignal` cancellation

## Run Demo
```sh
npm install
npm run demo
```
