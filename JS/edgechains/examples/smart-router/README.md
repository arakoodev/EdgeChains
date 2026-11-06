# Smart Router example (issue #286)

LiteLLM-style smart router for EdgeChains.js: load balancing across OpenAI,
PaLM and Cohere deployments with rate limiting (RPM/TPM rolling window),
429 cooldown + failover, retries with exponential backoff, streaming, token
usage tracking and Sentry/PostHog observability callbacks - all configured
from Jsonnet.

## How it works

-   `jsonnet/router.jsonnet` declares the deployments and routing rules
    (`cooldownMs`, `maxRetries`, `retryBackoffMs`, `timeoutMs`, per-deployment
    `rpmLimit`/`tpmLimit`).
-   `Router.fromJsonnet(config)` builds the router; at every call it picks the
    deployment that is below its rate limit and has used the fewest total
    tokens.
-   HTTP 429 respects `Retry-After` (or `cooldownMs`) and fails over to the
    next deployment; 5xx/timeouts are retried with exponential backoff via
    axios response interceptors.

## Run it

Build the SDK once first:

```bash
cd JS/edgechains/arakoodev
npm install
npx tsc -b

cd ../examples/smart-router
npm install
npm start
```

**Offline demo:** with no `OPENAI_API_KEY` / `COHERE_API_KEY` set (or the
placeholder values in `jsonnet/secrets.jsonnet`) the example starts a local
mock server and runs end-to-end without any network or keys - the first call
to `gpt-3.5-turbo` even returns a mock 429 to demonstrate the automatic
cooldown + failover.

**Live mode:** put real keys into `jsonnet/secrets.jsonnet` (or export
`OPENAI_API_KEY` / `COHERE_API_KEY`) and the same Jsonnet config routes to the
real APIs.

## Observability

The structured events emitted by `onSuccess` / `onFailure` are plain JSON
objects ready for Sentry and PostHog:

```ts
router.onSuccess = (e) => posthog.capture("llm.success", e);
router.onFailure = (e) => Sentry.captureException(new Error(e.error), { extra: e });
```

See `src/index.ts` for the full wiring, streaming loop and `console.table()`
of live deployment stats.
