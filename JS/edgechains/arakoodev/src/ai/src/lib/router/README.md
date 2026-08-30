# SmartRouter — Unified LLM Provider Router

`SmartRouter` is EdgeChains' answer to Python's
[`litellm`](https://github.com/BerriAI/litellm): one TypeScript API that
dispatches chat-completion requests to the right provider based on the
model name, with a normalized request and response shape.

```ts
import { SmartRouter } from "@arakoodev/edgechains.js/ai";

const router = new SmartRouter({
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    google: process.env.GOOGLE_API_KEY,
    cohere: process.env.COHERE_API_KEY,
});

const res = await router.complete({
    model: "gpt-4o", // or "claude-3-5-sonnet-20241022", "gemini-1.5-pro", "command-r-plus"
    messages: [
        { role: "system", content: "You are concise." },
        { role: "user", content: "Say hello." },
    ],
    temperature: 0.2,
    max_tokens: 256,
});

console.log(res.content, res.provider, res.usage);
```

## How routing works

The provider is inferred from the **model prefix**:

| Prefix                     | Provider    |
| -------------------------- | ----------- |
| `gpt-*`, `o1-*`, `o3-*`    | `openai`    |
| `claude-*`                 | `anthropic` |
| `gemini-*`, `models/gemini-*` | `google` |
| `command*`                 | `cohere`    |
| `llama-*`, `llama3-*`      | `llama`     |

You can force a provider with the `"<provider>/<model>"` syntax,
e.g. `"openai/some-finetune"` or `"anthropic/claude-experimental-id"`.

If the prefix is unknown, the router falls back to `defaultProvider`
(when set) or throws `RouterError`.

## Normalized shapes

```ts
interface RouterRequest {
    model: string;
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    temperature?: number;
    max_tokens?: number;
}

interface RouterResponse {
    content: string;
    provider: "openai" | "anthropic" | "google" | "cohere" | "llama" | "unknown";
    model: string;
    usage: { input_tokens: number; output_tokens: number };
    raw?: unknown; // full provider payload, kept for advanced use
}
```

System messages are pushed into each provider's correct slot
automatically (Anthropic's `system` field, Gemini's `systemInstruction`,
Cohere's `preamble`).

## Custom or local providers

Register an adapter at runtime — useful for Ollama, vLLM, a corporate
gateway, or any other provider:

```ts
import { SmartRouter, ProviderAdapter } from "@arakoodev/edgechains.js/ai";

const ollama: ProviderAdapter = {
    name: "llama",
    async complete(req) {
        // call your local endpoint, return a RouterResponse
    },
};

const router = new SmartRouter();
router.register("llama", ollama);
```

## Error handling

Every failure surfaces as `RouterError` with the originating provider,
the upstream HTTP status (when applicable), and the original error on
`.cause`:

```ts
import { RouterError } from "@arakoodev/edgechains.js/ai";

try {
    await router.complete({ model: "gpt-4o", messages });
} catch (e) {
    if (e instanceof RouterError) {
        console.error(e.provider, e.status, e.message, e.cause);
    }
}
```

## Scope of this MVP

- Built-in adapters for **OpenAI**, **Anthropic**, **Google Gemini**,
  and **Cohere**.
- Llama / other providers can be plugged in via `register()`.
- Streaming, tool calling, and embeddings are intentionally out of
  scope for this first PR and will land in follow-ups.
