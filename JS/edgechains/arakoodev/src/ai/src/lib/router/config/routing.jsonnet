// Example routing configuration for EdgeChains smart router.
// Use jsonnet to manage all routing config as per EdgeChains convention.
//
// Usage:
//   import this file and override fields to configure your router.
//
// Variables passed via std.extVar():
//   - openai_api_key
//   - gemini_api_key
//   - cohere_api_key (optional)

local openai_key = std.extVar('openai_api_key');
local gemini_key = std.extVar('gemini_api_key');

{
  routing_strategy: 'round-robin',  // 'round-robin' | 'least-tokens' | 'latency-based' | 'cost-based'
  num_retries: 3,
  timeout: 30000,
  cooldown_time: 60,
  allowed_fails: 3,

  model_list: [
    {
      model_name: 'gpt-4',
      provider: 'openai',
      litellm_model: 'gpt-4',
      api_key: openai_key,
      rpm: 60,
      tpm: 90000,
      input_cost_per_1k: 0.03,
      output_cost_per_1k: 0.06,
    },
    {
      model_name: 'gpt-4',
      provider: 'openai',
      litellm_model: 'gpt-4',
      api_key: openai_key,
      api_base: 'https://openai-fallback.example.com/v1',
      rpm: 60,
      tpm: 90000,
      input_cost_per_1k: 0.03,
      output_cost_per_1k: 0.06,
    },
    {
      model_name: 'gemini-pro',
      provider: 'gemini',
      litellm_model: 'gemini-pro',
      api_key: gemini_key,
      rpm: 60,
      tpm: 120000,
      input_cost_per_1k: 0.0005,
      output_cost_per_1k: 0.0015,
    },
  ],

  callbacks: {
    // Uncomment to enable:
    // sentry: { dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0' },
    // posthog: { api_key: 'phc_xxx', host: 'https://app.posthog.com' },
  },
}
