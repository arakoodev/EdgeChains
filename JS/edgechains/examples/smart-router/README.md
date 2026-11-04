# EdgeChains SmartRouter Example

Demonstrates LiteLLM-inspired routing across **OpenAI**, **Google PaLM**, and **Cohere** deployments configured via Jsonnet (`jsonnet/router.jsonnet`), featuring:

1. **Least-tokens load balancing** and **RPM/TPM rate-limit checks** with Axios interceptor retries and automatic failover.
2. **Streaming support** (`router.streamChat(...)`).
3. **Token usage tracking** (`router.getDeploymentStats()` and `router.getTotalTokensUsed()`).
4. **Sentry and PostHog observability callbacks**.
