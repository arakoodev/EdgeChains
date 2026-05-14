# PaLM2 Chat Example

This example shows how to call the PaLM2 client through an EdgeChains JSONNet workflow.

## Setup

1. Add your Google Generative Language API key in `jsonnet/secrets.jsonnet`.
2. Install dependencies:

```bash
npm install
```

3. Start the example:

```bash
npm run dev
```

4. Send a request:

```bash
curl -X POST http://localhost:3000/palm2-chat \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"Explain edge computing in one sentence.\"}"
```
