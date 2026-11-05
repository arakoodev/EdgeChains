# Palm2 Example (EdgeChains JS SDK)

Demonstrates the new `Palm2Endpoint` class (Google PaLM 2 / text-bison).

1. `export PALM2_API_KEY=your-key` (or put it in jsonnet secrets)
2. `npm install && npm run dev`
3. `curl "http://localhost:3000/?topic=quantum%20computing"`

Prompts live in `src/jsonnet/prompts.jsonnet` (not hardcoded), per repo convention.
