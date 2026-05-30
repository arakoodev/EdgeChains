// Smart Router Example — Router Configuration
// Used with @arakoodev/jsonnet for loading router config at runtime

local secrets = import 'secrets.jsonnet';

{
  strategy: "least-busy",
  maxRetries: 3,
  timeout: 60000,
  trackTokenUsage: true,

  logging: {
    logRequests: true,
    logTokenUsage: true,
    logErrors: true,
  },

  deployments: [
    {
      id: "openai-gpt4o",
      provider: "openai",
      model: "gpt-4o",
      apiKey: secrets.openaiApiKey,
      orgId: secrets.openaiOrgId,
      rpm: 500,
      isFallback: false,
      healthy: true,
      weight: 3,
    },
    {
      id: "gemini-pro",
      provider: "gemini",
      model: "gemini-pro",
      apiKey: secrets.geminiApiKey,
      rpm: 60,
      isFallback: false,
      healthy: true,
      weight: 1,
    },
    {
      id: "cohere-command-r",
      provider: "cohere",
      model: "command-r",
      apiKey: secrets.cohereApiKey,
      rpm: 100,
      isFallback: false,
      healthy: true,
      weight: 1,
    },
    {
      id: "openai-fallback",
      provider: "openai",
      model: "gpt-3.5-turbo",
      apiKey: secrets.openaiApiKey,
      isFallback: true,
      healthy: true,
    },
  ],
}
