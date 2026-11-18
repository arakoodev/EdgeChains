{
  "defaultTimeoutMs": 10000,
  "defaultMaxRetries": 2,
  "observability": {
    "sentryDsn": "https://public@sentry.example.com/1",
    "posthogApiKey": "phc_edgechains_example"
  },
  "deployments": [
    {
      "id": "openai-gpt35",
      "provider": "openai",
      "model": "gpt-3.5-turbo",
      "apiKey": "OPENAI_API_KEY",
      "rpmLimit": 60,
      "tpmLimit": 90000
    },
    {
      "id": "google-palm2",
      "provider": "palm",
      "model": "text-bison-001",
      "apiKey": "PALM2_API_KEY",
      "rpmLimit": 60,
      "tpmLimit": 90000
    },
    {
      "id": "cohere-command",
      "provider": "cohere",
      "model": "command",
      "apiKey": "COHERE_API_KEY",
      "rpmLimit": 60,
      "tpmLimit": 90000
    }
  ]
}
