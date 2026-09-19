// SmartRouter configuration via jsonnet
// All LLM deployments and routing strategy are configured here

local openai_key = std.extVar("openai_api_key");
local gemini_key = std.extVar("gemini_api_key");
local cohere_key = std.extVar("cohere_api_key");

{
  // Routing strategy: "least-tokens" | "round-robin" | "fallback"
  strategy: "least-tokens",

  // Default settings for all requests
  default_max_tokens: 512,
  default_temperature: 0.7,
  retry_delay_ms: 1000,

  // Model deployments — router picks the best one per request
  deployments: [
    {
      provider: "openai",
      api_key: openai_key,
      model: "gpt-3.5-turbo",
      max_retries: 3,
      timeout: 30000,
      rpm_limit: 60,       // requests per minute
      tpm_limit: 90000,    // tokens per minute
    },
    {
      provider: "gemini",
      api_key: gemini_key,
      model: "gemini-pro",
      max_retries: 3,
      timeout: 30000,
      rpm_limit: 60,
      tpm_limit: 100000,
    },
    {
      provider: "cohere",
      api_key: cohere_key,
      model: "command",
      max_retries: 2,
      timeout: 25000,
      rpm_limit: 40,
      tpm_limit: 50000,
    },
  ],
}
