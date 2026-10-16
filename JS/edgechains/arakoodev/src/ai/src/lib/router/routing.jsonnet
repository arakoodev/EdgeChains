{
  deployments: [
    {
      provider: "openai",
      model: "gpt-4",
      weight: 2,
      rateLimitRPM: 60,
    },
    {
      provider: "openai",
      model: "gpt-3.5-turbo",
      weight: 1,
      rateLimitRPM: 100,
    },
    {
      provider: "gemini",
      model: "gemini-pro",
      weight: 1,
      rateLimitRPM: 60,
    },
    {
      provider: "cohere",
      model: "command-r",
      weight: 1,
      rateLimitRPM: 40,
    },
  ],
  logging: {
    sentry: { enabled: false },
    posthog: { enabled: false },
  },
  defaults: {
    temperature: 0.7,
    maxTokens: 1024,
  },
}
