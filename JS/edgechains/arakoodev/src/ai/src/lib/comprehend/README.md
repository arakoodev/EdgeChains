# AWS Comprehend PII Redactor for EdgeChains

Utility for detecting and redacting Personally Identifiable Information (PII) using AWS Comprehend with observable pipeline chaining.

## Features

- **Injectable Client**: Inversion-of-control client injection for testing and zero-cloud environments.
- **SigV4 REST Signing**: Built-in AWS Signature Version 4 signer using native Node.js crypto.
- **Span-based Redaction**: Deterministic redaction using character offsets, eliminating drift issues.
- **Multiple Redaction Modes**: `REPLACE_LABEL`, `MASK`, `REMOVE`, and custom replacer functions.
- **Observable Chaining**: `PromptRedactionObservable` for pipeline transformation and integration with EdgeChains chat endpoints.
- **Local Fallback**: Regex-based local PII fallback rules for development and testing.
