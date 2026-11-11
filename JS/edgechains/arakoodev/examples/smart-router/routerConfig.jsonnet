{
  routingStrategy: "least-tokens-used",
  maxRetries: 3,
  cooldownMs: 30000,
  deployments: [
    { id: "openai-primary", provider: "openai", model: "gpt-3.5-turbo", rateLimitRpm: 60, rateLimitTpm: 90000 },
    { id: "palm2-secondary", provider: "palm2", model: "text-bison-001", rateLimitRpm: 60, rateLimitTpm: 90000 },
    { id: "cohere-fallback", provider: "cohere", model: "command", rateLimitRpm: 60, rateLimitTpm: 90000 }
  ]
}
