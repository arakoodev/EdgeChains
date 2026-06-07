# SmartRouter

Config-driven request router for the JS SDK that balances deployments across **OpenAI**, **Google**, and **Cohere** while respecting token limits, retries, and failover rules.

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
    { id: "google-1", provider: "google", apiKey: process.env.GOOGLE_API_KEY },
    {
      id: "cohere-1",
      provider: "cohere",
      apiKey: process.env.COHERE_API_KEY,
      model: "command-r",
    },
  ],
  retries: 2,
  timeoutMs: 30000,
});

const response = await router.chat({ prompt: "Hello world" });
console.log(response.content);
```

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
      model: "gemini-pro",
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
}
```

Render it at build time and pass the JSON into `createSmartRouterFromConfig`:

```typescript
import config from "./router.config.json";
import { createSmartRouterFromConfig } from "@arakoodev/edgechains.js/ai";

const router = createSmartRouterFromConfig(config);
```

## Provider defaults

| Provider | Default endpoint                                                                 | Auth header                      | Payload shape                                         |
| -------- | -------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------- |
| OpenAI   | `https://api.openai.com/v1/chat/completions`                                     | `Authorization: Bearer <apiKey>` | `{ model, messages, stream }`                         |
| Google   | `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent` | `x-goog-api-key: <apiKey>`       | `{ contents: [{ role: "user", parts: [{ text }] }] }` |
| Cohere   | `https://api.cohere.ai/v1/chat`                                                  | `Authorization: Bearer <apiKey>` | `{ model, message, stream }`                          |

Override any endpoint via `baseUrl` on a deployment.

## Features

- **Token-aware routing** — picks the deployment with the lowest tracked usage that is under its `tokenLimit`.
- **Retries** — retries non-429 errors up to the configured count.
- **429 failover** — immediately switches to the next available deployment on rate-limit.
- **Streaming pass-through** — `router.stream()` returns the raw async iterable from the selected deployment.
- **Callbacks** — optional `sentry` and `posthog` callbacks receive structured log events (`deployment_attempt`, `deployment_success`, `deployment_rate_limited`, `deployment_failed`).
- **Timeout** — per-request abort via `AbortController` using `timeoutMs` (global or per-deployment).

## Backward compatibility

The public `OpenAI` class is still exported and its `chat` / `streamedChat` methods now delegate through an internal `SmartRouter` deployment. Other paths (embeddings, function calling, zod schema) remain direct axios calls because they do not map cleanly to the chat router abstraction.
