local openai_api_key = std.extVar('OPENAI_API_KEY');
local gemini_api_key = std.extVar('GEMINI_API_KEY');
local cohere_api_key = std.extVar('COHERE_API_KEY');
local sentry_dsn = std.extVar('SENTRY_DSN');
local posthog_key = std.extVar('POSTHOG_API_KEY');

{
  router_settings: {
    routing_strategy: "least-tokens",
    num_retries: 3,
    timeout: 30000,
    cooldown_time: 60,
    allowed_fails: 3,
  },

  model_list: [
    {
      model_name: "gpt-3.5-turbo",
      provider: "openai",
      api_key: openai_api_key,
      api_base: "https://api.openai.com/v1",
      rpm: 3000,
      tpm: 90000,
      priority: 1,
    },
    {
      model_name: "gpt-3.5-turbo",
      provider: "openai",
      api_key: openai_api_key,
      api_base: "https://api.openai.com/v1",
      rpm: 3000,
      tpm: 90000,
      priority: 2,
    },
    {
      model_name: "gpt-4",
      provider: "openai",
      api_key: openai_api_key,
      rpm: 500,
      tpm: 30000,
      priority: 3,
    },
    {
      model_name: "gemini-pro",
      provider: "gemini",
      api_key: gemini_api_key,
      rpm: 60,
    },
    {
      model_name: "gemini-1.5-flash",
      provider: "gemini",
      api_key: gemini_api_key,
      rpm: 120,
    },
    {
      model_name: "command-r",
      provider: "cohere",
      api_key: cohere_api_key,
      rpm: 100,
    },
    {
      model_name: "command-r-plus",
      provider: "cohere",
      api_key: cohere_api_key,
      rpm: 50,
    },
  ],

  callbacks: {
    sentry: {
      enabled: if sentry_dsn != "" then true else false,
      dsn: sentry_dsn,
    },
    posthog: {
      enabled: if posthog_key != "" then true else false,
      api_key: posthog_key,
      api_host: "https://app.posthog.com",
    },
  },
}
