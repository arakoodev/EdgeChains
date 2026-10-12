# SmartRouter

Load-balancing router for OpenAI / Google PaLM / Cohere chat completions.
Inspired by [LiteLLM's router](https://docs.litellm.ai/docs/routing) — closes
[#286](https://github.com/arakoodev/EdgeChains/issues/286).

## Usage

```ts
import { SmartRouter, sentryCallback, posthogCallback } from "@arakoodev/edgechains.js/ai";

const router = new SmartRouter({ retries: 2, fallback_attempts: 4 });

router.register({
    provider: "openai",
    api_key: process.env.OPENAI_API_KEY!,
    model: "gpt-3.5-turbo",
    rpm_limit: 3500,
    tpm_limit: 90_000,
});
router.register({
    provider: "cohere",
    api_key: process.env.COHERE_API_KEY!,
    model: "command",
});
router.register({
    provider: "google_palm",
    api_key: process.env.PALM_API_KEY!,
    model: "text-bison-001",
});

const r = await router.chat({ prompt: "What is the capital of France?" });
console.log(r.content, r.usage);

// Streaming
for await (const chunk of router.stream({ prompt: "Stream this" })) {
    if (chunk.delta) process.stdout.write(chunk.delta);
}
```

## Routing rules

On every call the router picks the deployment that:

1. matches the requested `model` (if specified)
2. is below its `rpm_limit` and `tpm_limit` for the current minute
3. is not currently in 429 cooldown
4. has the **fewest cumulative tokens used** so far

On a 429 the deployment is cooled until the next minute window and traffic
fails over to the next eligible deployment. Network errors and 5xx are
retried in place by `axios-retry` with exponential backoff (configurable via
`retries`).

## Token usage

Every `ChatResponse` and final `StreamChunk` carries a `usage` object
(`{ prompt_tokens, completion_tokens, total_tokens }`). Per-deployment
counters are exposed via `router.getUsage(deploymentId)`.

## Logging callbacks

```ts
import * as Sentry from "@sentry/node";
import { PostHog } from "posthog-node";

router.addCallback(sentryCallback(Sentry));
router.addCallback(
    posthogCallback(new PostHog(process.env.POSTHOG_KEY!), { distinctId: "prod-router" })
);
```

Both callbacks accept the client at construction time so the SDK doesn't
pull `@sentry/node` or `posthog-node` as hard dependencies.

## Jsonnet config

The router takes plain JS objects, so any jsonnet output that compiles to
the `Deployment` shape works directly:

```jsonnet
// router.jsonnet
{
    deployments: [
        { provider: "openai", api_key: std.extVar("OPENAI_KEY"), model: "gpt-3.5-turbo", rpm_limit: 3500 },
        { provider: "cohere", api_key: std.extVar("COHERE_KEY"), model: "command" },
    ],
}
```

```ts
import jsonnet from "@arakoodev/jsonnet";
const cfg = JSON.parse(jsonnet.evaluateFile("router.jsonnet"));
for (const d of cfg.deployments) router.register(d);
```
