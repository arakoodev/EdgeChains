# palm2-example

Minimal example of using the Google PaLM 2 API through the EdgeChains
JavaScript SDK (`PaLM2Client`).

## Setup

1. Add your Google Generative Language API key to
   `jsonnet/secrets.jsonnet` (`palm_api_key`). Create a key at
   https://developers.generativeai.google/.
2. From this directory:

```bash
npm install
npm start
```

The server listens on port 3000.

## Usage

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "What is a vector database?"}'
```

## Notes

- The prompt template lives in `jsonnet/main.jsonnet` (`std.extVar` for the
  key and the question), and the native PaLM 2 call in
  `src/lib/palm2Call.cts` — no secrets or prompts are hardcoded in the
  TypeScript source.
- `src/index.ts` follows the same ArakooServer + Jsonnet pattern as the
  other examples in this repository.
