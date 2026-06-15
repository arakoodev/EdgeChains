// EdgeChains Smart Router Configuration
// Inspired by LiteLLM's router configuration pattern
//
// This Jsonnet file defines the routing configuration for multiple LLM
// deployments, including load balancing strategy, retry policies, and
// deployment-specific settings.

local secrets = import 'secrets.jsonnet';

{
  // Load balancing strategy: "least-busy" | "round-robin" | "weighted" | "random"
  strategy: "least-busy",

  // Maximum number of retry attempts across all deployments
  maxRetries: 3,

  // Timeout in milliseconds for each request
  timeout: 60000,

  // Whether to track and report token usage
  trackTokenUsage: true,

  // Logging/observability configuration
  logging: {
    // Sentry DSN for error tracking (optional)
    sentryDsn: "",

    // PostHog API key for analytics (optional)
    posthogApiKey: "",

    // PostHog host
    posthogHost: "https://app.posthog.com",

    // Logging toggles
    logRequests: true,
    logTokenUsage: true,
    logErrors: true,
  },

  // Deployment configurations
  deployments: [
    // ─── Primary OpenAI Deployments ──────────────────────────────
    {
      id: "openai-primary",
      provider: "openai",
      model: "gpt-4o",
      apiKey: secrets.openaiApiKey,
      orgId: secrets.openaiOrgId,
      rpm: 500,
      tpm: 150000,
      isFallback: false,
      healthy: true,
      weight: 3,
    },
    {
      id: "openai-secondary",
      provider: "openai",
      model: "gpt-3.5-turbo",
      apiKey: secrets.openaiApiKey,
      orgId: secrets.openaiOrgId,
      rpm: 3500,
      tpm: 1000000,
      isFallback: false,
      healthy: true,
      weight: 2,
    },

    // ─── Primary Gemini Deployment ───────────────────────────────
    {
      id: "gemini-primary",
      provider: "gemini",
      model: "gemini-pro",
      apiKey: secrets.geminiApiKey,
      rpm: 60,
      tpm: 60000,
      isFallback: false,
      healthy: true,
      weight: 1,
    },

    // ─── Primary Cohere Deployment ───────────────────────────────
    {
      id: "cohere-primary",
      provider: "cohere",
      model: "command-r",
      apiKey: secrets.cohereApiKey,
      rpm: 100,
      tpm: 100000,
      isFallback: false,
      healthy: true,
      weight: 1,
    },

    // ─── Fallback Deployments ────────────────────────────────────
    {
      id: "openai-fallback",
      provider: "openai",
      model: "gpt-3.5-turbo",
      apiKey: secrets.openaiApiKey,
      orgId: secrets.openaiOrgId,
      rpm: 3500,
      tpm: 1000000,
      isFallback: true,
      healthy: true,
      weight: 1,
    },
    {
      id: "gemini-fallback",
      provider: "gemini",
      model: "gemini-pro",
      apiKey: secrets.geminiApiKey,
      rpm: 60,
      tpm: 60000,
      isFallback: true,
      healthy: true,
      weight: 1,
    },
  ],
}
