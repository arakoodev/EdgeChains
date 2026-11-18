# Smart Router Example (Inspired by LiteLLM)

This example demonstrates how to use `SmartRouter` from `@arakoodev/edgechains.js/ai` to route requests across multiple LLM providers (`OpenAI`, `Google PaLM`, `Cohere`) with least-token load balancing, RPM/TPM rate-limiting, automatic 429 failover, streaming, and observability logging.

## Features Demonstrated

1. **Least-Token Load Balancing**: Automatically routes requests to the deployment that is below its rate limits and has consumed the least cumulative tokens.
2. **Reliability & Retry**: Built-in Axios interceptor for retrying transient 500/502/503/504 errors.
3. **Streaming Support**: Stream tokens via `router.streamChat(...)` async generator while maintaining accurate token metrics.
4. **Jsonnet Configuration**: Declarative deployment routing setup loaded directly via `SmartRouter.fromJsonnet(...)`.
5. **Observability**: Integrates with Sentry for error tracking and PostHog for generation metrics.

## Running the Example

```bash
npm install
npm run build
npm start
```
