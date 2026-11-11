local defaultTimeoutMs = 10000;
local defaultMaxRetries = 2;
local defaultRetryDelayMs = 50;

{
    routingStrategy: "least-tokens-used",
    timeoutMs: defaultTimeoutMs,
    maxRetries: defaultMaxRetries,
    retryDelayMs: defaultRetryDelayMs,
    deployments: [
        {
            id: "openai-primary",
            provider: "openai",
            model: "gpt-3.5-turbo",
            apiKey: "mock-openai-key-1",
            endpoint: "https://api.openai.com/v1/chat/completions",
            rateLimitRpm: 60,
            rateLimitTpm: 90000,
            timeoutMs: defaultTimeoutMs,
            maxRetries: defaultMaxRetries,
        },
        {
            id: "palm-primary",
            provider: "palm",
            model: "models/chat-bison-001",
            apiKey: "mock-palm-key-1",
            endpoint: "https://generativelanguage.googleapis.com/v1beta2/models/chat-bison-001:generateMessage",
            rateLimitRpm: 60,
            rateLimitTpm: 60000,
            timeoutMs: defaultTimeoutMs,
            maxRetries: defaultMaxRetries,
        },
        {
            id: "cohere-primary",
            provider: "cohere",
            model: "command",
            apiKey: "mock-cohere-key-1",
            endpoint: "https://api.cohere.ai/v1/generate",
            rateLimitRpm: 60,
            rateLimitTpm: 60000,
            timeoutMs: defaultTimeoutMs,
            maxRetries: defaultMaxRetries,
        },
    ],
    observability: {
        sentry: {
            enabled: true,
            dsn: "https://public@sentry.example.com/1",
        },
        posthog: {
            enabled: true,
            apiKey: "phc_mock_key",
            host: "https://app.posthog.com",
        },
    },
}
