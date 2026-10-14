# Gemini chat with Jsonnet

This example runs a local `POST /chat` API. It evaluates `jsonnet/chat.jsonnet`
for each question, then calls the EdgeChains `GeminiAI` HTTP client. Prompts and
generation settings live in Jsonnet; the API key stays in the process environment.
No Google SDK is used.

From the repository root:

```sh
cd JS/edgechains/arakoodev
npm install
npm run build
cd ../examples/gemini-chat
npm install
```

Set `GEMINI_API_KEY` and `GEMINI_MODEL` in your local environment, choosing a model
available to your Google account. The client accepts either `model-name` or
`models/model-name`. There is no hardcoded model default.

```sh
npm start
curl --fail-with-body http://127.0.0.1:3000/chat \
  -H 'Content-Type: application/json' \
  -d '{"question":"What is two plus two?"}'
```

Starting the server does not call Google; sending a question does. Google requests
use your account's quota and may incur charges. The endpoint returns Google's
response, including safety feedback when there are no candidates. Keep this sample
bound to localhost; it does not implement authentication for public deployment.

## Client options

`GeminiAI.chat()` accepts `prompt`, `model`, `temperature`, `max_output_tokens`,
`top_p`, `top_k`, `candidate_count`, `stop_sequences` and `responseType`.
These map to Google's `contents` and `generationConfig` fields. Omitted generation
settings use Google's defaults; explicit zero values are preserved.
`generateContent()` accepts a typed multi-turn request with optional system
instruction and safety settings. Both methods return the full response, so callers
must handle absent candidates and safety feedback rather than assuming text exists.

Model selection is request option, then constructor option, then `GEMINI_MODEL`.
Set the constructor's `timeout` in milliseconds if the default 30 seconds is not
appropriate. Per-request `max_retry` means **total attempts**, default three;
`delay` is the pause in milliseconds, default 200. Only network failures, HTTP
408, 429 and 5xx responses are retried. Permanent HTTP failures throw
`GeminiAPIError` with a `status`; its message does not include Axios credentials.

## Local verification without a key

From `JS/edgechains/arakoodev`:

```sh
npm run test:palm2
PALM2_DEMO=1 npm run test:palm2 -- -t 'runs the Jsonnet HTTP example'
```

The integration tests start two real loopback HTTP servers: this `/chat` example
and a deterministic Gemini wire fixture. They evaluate Jsonnet, invoke the real
client and inspect the received HTTP request and returned response. The demo prints
those recorded values and asserts that the zero temperature reaches the fixture.
This verifies the local integration, not Google availability, model output or
billing. No Google API call is made by these tests.
