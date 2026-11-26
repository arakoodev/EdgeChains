# palm2-chat — issue #279 example

Google retired PaLM 2 (`text-bison-001`, `chat-bison-001`), so this example uses
`GeminiAI` / the `Palm2AI` compatibility alias against the supported Gemini
`generateContent` endpoint. All prompts and the system instruction come from
`jsonnet/prompts.jsonnet`; no prompt is hardcoded in TypeScript.

## Run

```bash
cd JS/edgechains/examples/palm2-chat
npm install
GEMINI_API_KEY=your-key npm start -- "Explain PII redaction"
```

Optional environment variables:

- `GEMINI_MODEL` — any Gemini model id (default: `gemini-2.0-flash`)
- `GEMINI_BASE_URL` — proxy/local fixture, e.g. `http://127.0.0.1:8080/v1beta`
  (the client appends `/models/<model>:generateContent`)

The offline unit tests in `../../arakoodev/src/ai/src/tests/palm2/` use the same
Jsonnet prompt-loading approach against a local HTTP fixture server.
