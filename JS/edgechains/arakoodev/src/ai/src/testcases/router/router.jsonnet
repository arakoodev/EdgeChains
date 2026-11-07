{
  defaultTimeoutMs: 10000,
  defaultMaxRetries: 2,
  deployments: [
    {
      id: "openai-gpt-4o-mini",
      provider: "openai",
      model: "gpt-4o-mini",
      apiKey: "env.OPENAI_API_KEY",
      endpoint: "https://api.openai.com/v1/chat/completions",
      rpmLimit: 60,
      tpmLimit: 90000,
    },
    {
      id: "google-palm-bison",
      provider: "palm",
      model: "text-bison-001",
      apiKey: "env.PALM_API_KEY",
      endpoint: "https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText",
      rpmLimit: 60,
      tpmLimit: 60000,
    },
    {
      id: "cohere-command",
      provider: "cohere",
      model: "command",
      apiKey: "env.COHERE_API_KEY",
      endpoint: "https://api.cohere.ai/v1/generate",
      rpmLimit: 60,
      tpmLimit: 60000,
    },
  ],
}
