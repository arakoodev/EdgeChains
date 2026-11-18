// Jsonnet routing configuration for EdgeChains LiteLLM-style SmartRouter
{
  "defaultTimeoutMs": 5000,
  "defaultMaxRetries": 2,
  "retryDelayMs": 1,
  "observability": {
    "sentryDsn": "https://public@sentry.example.com/1",
    "posthogApiKey": "phc_edgechains_test_key",
    "posthogHost": "https://app.posthog.com"
  },
  "deployments": [
    {
      "id": "openai-primary",
      "provider": "openai",
      "model": "gpt-3.5-turbo",
      "apiKey": "sk-test-openai",
      "rpmLimit": 2,
      "tpmLimit": 500
    },
    {
      "id": "palm-secondary",
      "provider": "palm",
      "model": "text-bison-001",
      "apiKey": "palm-test-key",
      "rpmLimit": 5,
      "tpmLimit": 1000
    },
    {
      "id": "cohere-tertiary",
      "provider": "cohere",
      "model": "command",
      "apiKey": "cohere-test-key",
      "rpmLimit": 5,
      "tpmLimit": 1000
    }
  ]
}
