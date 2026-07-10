# SmartRouter

Config-driven request router for the JS SDK that balances deployments across **OpenAI**, **Google**, and **Cohere** while respecting token limits, retries, rate-limit cooldowns, timeouts, and failover rules.

## Quick start

```typescript
import {
  SmartRouter,
  createSmartRouterFromConfig,
} from "@arakoodev/edgechains.js/ai";

const router = new SmartRouter({
  deployments: [
    {
      id: "openai-1",
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      model: "gpt-4",
    },
    {
      id: "google-1",
      provider: "google",
      apiKey: process.env.GOOGLE_API_KEY,
      model: "gemini-1.5-pro",
    },
    {
      id: "cohere-1",
      provider: "cohere",
      apiKey: process.env.COHERE_API_KEY,
      model: "command-r",
    },
  ],
  retries: 2,
  timeoutMs: 30000,
  rateLimitCooldownMs: 60000,
});

const response = await router.chat({ prompt: "Hello world" });
console.log(response.content);
```

## Streaming

`router.stream()` requests a provider stream and returns an `AsyncIterable`. Built-in Axios requests use `responseType: "stream"`; custom handlers must return an async iterable themselves.

```typescript
const stream = await router.stream({ prompt: "Explain routing" });
for await (const chunk of stream) {
  process.stdout.write(String(chunk));
}
```

Google streaming automatically switches from `generateContent` to `streamGenerateContent?alt=sse`.

## Config from jsonnet

`createSmartRouterFromConfig` accepts a plain object, so a jsonnet-rendered config can be passed directly without adding a jsonnet runtime dependency.

**Example jsonnet template** (see `tests/fixtures/smartRouter.config.jsonnet`):

```jsonnet
{
  deployments: [
    {
      id: "openai-primary",
      provider: "openai",
      apiKey: "sk-openai-test",
      model: "gpt-3.5-turbo",
      tokenLimit: 100000,
      tokenUsage: 0,
    },
    {
      id: "google-primary",
      provider: "google",
      apiKey: "sk-google-test",
      model: "gemini-1.5-pro",
      tokenLimit: 100000,
      tokenUsage: 0,
    },
    {
      id: "cohere-primary",
      provider: "cohere",
      apiKey: "sk-cohere-test",
      model: "command-r",
      tokenLimit: 100000,
      tokenUsage: 0,
    },
  ],
  retries: 2,
  timeoutMs: 30000,
  rateLimitCooldownMs: 60000,
}
```

Render it at build time and pass the JSON into `createSmartRouterFromConfig`:

```typescript
import config from "./router.config.json";
import { createSmartRouterFromConfig } from "@arakoodev/edgechains.js/ai";

const router = createSmartRouterFromConfig(config);
```

## Provider defaults

| Provider | Default endpoint | Auth header | Payload shape |
| --- | --- | --- | --- |
| OpenAI | `https://api.openai.com/v1/chat/completions` | `Authorization: Bearer <apiKey>` | `{ model, messages, stream }` |
| Google | `https://generativelanguage.googleapis.com/v1/models/<model>:generateContent` | `x-goog-api-key: <apiKey>` | `{ contents: [{ role, parts: [{ text }] }] }` |
| Cohere | `https://api.cohere.ai/v1/chat` | `Authorization: Bearer <apiKey>` | `{ model, message, stream }` |

Override any endpoint via `baseUrl` on a deployment.

## Routing and reliability behavior

- **Token-aware routing** — selects the available deployment with the lowest tracked usage under its `tokenLimit`.
- **Retries** — retries non-429 failures up to the configured count.
- **Handler and network timeouts** — both custom handlers and Axios requests honor global or per-deployment `timeoutMs`.
- **429 failover** — immediately tries another deployment and stores a cooldown across later requests.
- **Retry-After support** — honors numeric seconds or HTTP-date values before using `rateLimitCooldownMs`.
- **Streaming pass-through** — validates that the selected deployment returned an async iterable.
- **Callbacks** — Sentry and PostHog hooks receive structured events independently; a callback failure cannot break routing.
- **Configuration validation** — rejects duplicate deployment IDs, negative limits/usages/retries, and invalid timeouts.

Use `router.getUsage(id)` to inspect tracked token usage and `router.getRateLimitedUntil(id)` to inspect a deployment cooldown.

## Backward compatibility and migration

The public `OpenAI` class remains exported to avoid an immediate breaking change. Its `chat` and `streamedChat` paths delegate through an internal `SmartRouter` deployment. New code and new examples should instantiate `SmartRouter` directly so OpenAI, Google, and Cohere deployments share the same routing, retry, streaming, usage, and callback behavior.

Embeddings, function calling, and schema-specific helpers remain direct compatibility paths because the current router request/response contract is chat-focused. Removing those legacy paths should be handled as a separately versioned breaking change rather than silently changing the existing public API in this bounty PR.

## Verification coverage

The focused tests cover least-usage selection, token limits, retries, 429 failover, persistent cooldowns, handler timeout failover, callback isolation, provider payloads, Google multi-message mapping, streaming validation, usage normalization, config construction, and invalid configuration.
