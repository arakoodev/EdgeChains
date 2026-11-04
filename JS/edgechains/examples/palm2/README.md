This example uses the Gemini Generative Language HTTP API, the PaLM successor
[approved for issue #279](https://github.com/arakoodev/EdgeChains/issues/279#issuecomment-1893108014).
`Palm2AI` is an alias for `GeminiAI`; it does not call the retired Bison API.
Prompts and generation options are evaluated from `jsonnet/main.jsonnet`.
The API key stays in the environment.

Build the local SDK first:

```sh
cd ../../arakoodev
npm install
npm run build
cd ../examples/palm2
npm install
GEMINI_API_KEY=your-key npm start
```

Choose a model available to your Google account in `jsonnet/main.jsonnet`.
The client sends `contents` and `generationConfig` to
`v1beta/models/{model}:generateContent`, using `x-goog-api-key` authentication.
`model` accepts either a bare name or a `models/` prefix.
The full Google response is returned, including safety feedback when no candidate
is generated. Public request, response, chat and construction types are exported
under both `GeminiAI*` and `Palm2AI*` names from `@arakoodev/edgechains.js/ai`.

Run the local HTTP fixture tests without a Google key:

```sh
cd ../../arakoodev
npm install
npm test -- --run src/ai/src/tests/testcases/palm2
```

These tests start a local API and verify requests, responses, failures and retries
using evaluated Jsonnet prompts. They do not verify Google's live service.
