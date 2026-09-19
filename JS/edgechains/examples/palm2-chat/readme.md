# PaLM2 Chat Example

This example calls the PaLM2 text generation API through `@arakoodev/edgechains.js/ai`.

The prompt template lives in `jsonnet/main.jsonnet` so the example can change prompts without recompiling TypeScript.

```bash
npm install
npm run start
```

POST a question to the local server:

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"What is EdgeChains?"}'
```
