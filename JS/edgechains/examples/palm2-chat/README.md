# EdgeChains Google PaLM 2 Chat Example

This example demonstrates how to integrate Google PaLM 2 (`text-bison-001` and `chat-bison-001`) with EdgeChains using **Jsonnet prompt templates** without hardcoding prompts in TypeScript.

## Prerequisites

1. Set your Google API key in `jsonnet/secrets.jsonnet` or in your environment:
   ```bash
   export PALM2_API_KEY="AIzaSy..."
   ```

## Running the Server

```bash
npm install
npm run start
```

## Testing the Endpoint

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the core benefits of EdgeChains prompt orchestration?"}'
```
