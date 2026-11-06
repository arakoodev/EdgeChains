# Palm2 Example (EdgeChains JS SDK)

Demonstrates the `Palm2Endpoint` class (Google PaLM 2 / `text-bison-001`) with prompts configured declaratively in Jsonnet.

1. `export PALM2_API_KEY=your-key` (read via Jsonnet `std.extVar`)
2. `npm install && npm run dev`
3. `curl "http://localhost:3000/?topic=quantum%20computing"`

Prompts live in `src/jsonnet/prompts.jsonnet` rather than being hardcoded in TypeScript.
