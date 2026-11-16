// Jsonnet Routing Configuration for EdgeChains SmartRouter (Issue #286)
local defaultRetry = {
  timeoutMs: 10000,
  maxRetries: 2,
  retryDelayMs: 100,
};

{
  router: {
    cooldownMs: 30000,
    callbacks: ["sentry", "posthog"],
    deployments: [
      defaultRetry + {
        id: "openai-primary",
        provider: "openai",
        model: "gpt-4o",
        apiKey: std.extVar("OPENAI_API_KEY"),
        endpointUrl: "https://api.openai.com/v1/chat/completions",
        rpmLimit: 60,
        tpmLimit: 90000,
      },
      defaultRetry + {
        id: "palm-secondary",
        provider: "palm",
        model: "chat-bison-001",
        apiKey: std.extVar("PALM_API_KEY"),
        endpointUrl: "https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:generateMessage",
        rpmLimit: 60,
        tpmLimit: 60000,
      },
      defaultRetry + {
        id: "cohere-tertiary",
        provider: "cohere",
        model: "command",
        apiKey: std.extVar("COHERE_API_KEY"),
        endpointUrl: "https://api.cohere.ai/v1/chat",
        rpmLimit: 60,
        tpmLimit: 60000,
      },
    ],
  },
}
