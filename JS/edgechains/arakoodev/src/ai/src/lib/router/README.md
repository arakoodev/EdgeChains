# SmartRouter

`SmartRouter` is a LiteLLM-style router for EdgeChains' JS SDK. It provides one completion interface across OpenAI, Google PaLM/Gemini, and Cohere while keeping provider deployments healthy under rate limits.

## Why this replaces direct endpoint calls

Direct provider calls fail the whole request when a single key or deployment is rate-limited. `SmartRouter` keeps a small in-memory state per deployment and routes to the best eligible deployment for each call:

1. match the requested model group
2. skip deployments in 429 cooldown
3. skip deployments over RPM/TPM limits
4. choose by `least-tokens`, `latency`, `cost`, `weighted`, or `priority`
5. retry transient 5xx/connection errors in-place with jittered backoff
6. fail over to the next deployment or configured fallback group

## Usage

```ts
import { SmartRouter, posthogCallback, sentryCallback } from "@arakoodev/edgechains.js/ai";

const router = new SmartRouter({
    strategy: "least-tokens",
    retries: 2,
    fallbackAttempts: 8,
    modelGroups: [
        {
            name: "fast-chat",
            fallbacks: ["cheap-chat"],
            deployments: [
                {
                    id: "openai-primary",
                    provider: "openai",
                    model: "gpt-4o",
                    apiKey: process.env.OPENAI_API_KEY,
                    rpmLimit: 3000,
                    tpmLimit: 90_000,
                    cost: { input: 0.000005, output: 0.000015 },
                },
                {
                    id: "gemini-primary",
                    provider: "gemini",
                    model: "gemini-pro",
                    apiKey: process.env.GEMINI_API_KEY,
                    latencyMs: 400,
                    weight: 2,
                },
            ],
        },
        {
            name: "cheap-chat",
            strategy: "cost",
            deployments: [
                {
                    id: "cohere-backup",
                    provider: "cohere",
                    model: "command",
                    apiKey: process.env.COHERE_API_KEY,
                    cost: { input: 0.0000015, output: 0.000002 },
                },
            ],
        },
    ],
});

const response = await router.completion({
    model: "fast-chat",
    messages: [{ role: "user", content: "Summarize EdgeChains" }],
});

console.log(response.content, response.usage, response.deployment_id);
```

## Streaming

```ts
for await (const chunk of router.stream({ model: "fast-chat", prompt: "Stream this" })) {
    if (chunk.delta) process.stdout.write(chunk.delta);
}
```

OpenAI and Gemini streaming are consumed as SSE. Cohere streaming supports SSE and JSON-line responses. PaLM `generateText` does not expose a stable streaming API, so PaLM deployments emit the full response as one chunk plus a final `done` chunk to preserve one caller shape.

## Jsonnet configuration

EdgeChains favors jsonnet for configuration. The router intentionally accepts plain objects so a jsonnet file can compile directly into the router config without adding a jsonnet runtime dependency to every consumer.

```jsonnet
{
    strategy: "least-tokens",
    retries: 2,
    modelGroups: [
        {
            name: "chat",
            fallbacks: ["backup"],
            deployments: [
                {
                    id: "openai-a",
                    provider: "openai",
                    model: "gpt-4o",
                    apiKeyEnv: "OPENAI_API_KEY",
                    rpmLimit: 3000,
                    tpmLimit: 90000,
                },
            ],
        },
        {
            name: "backup",
            deployments: [
                {
                    id: "cohere-a",
                    provider: "cohere",
                    model: "command",
                    apiKeyEnv: "COHERE_API_KEY",
                },
            ],
        },
    ],
}
```

```ts
const config = JSON.parse(renderedJsonnet);
const router = SmartRouter.fromConfig(config);
```

## Observability

The router ships dependency-free Sentry and PostHog adapters. Pass clients from the application; the SDK does not import those packages.

```ts
router.addCallback(sentryCallback(Sentry));
router.addCallback(posthogCallback(posthog, { distinctId: "prod" }));
```

Callbacks are isolated: callback errors are logged and never break the routed completion.
