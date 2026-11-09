local openaiKey = std.extVar("openai_api_key");
local palmKey = std.extVar("palm_api_key");
local cohereKey = std.extVar("cohere_api_key");

{
    timeout: 15000,
    maxRetries: 2,
    retryDelay: 10,
    cooldownMs: 5000,
    successCallbacks: ["sentry", "posthog"],
    failureCallbacks: ["sentry", "posthog"],
    deployments: [
        {
            id: "openai-gpt-3.5",
            provider: "openai",
            model: "gpt-3.5-turbo",
            apiKey: openaiKey,
            rpmLimit: 60,
            tpmLimit: 90000,
        },
        {
            id: "palm-bison",
            provider: "palm",
            model: "text-bison-001",
            apiKey: palmKey,
            rpmLimit: 60,
            tpmLimit: 60000,
        },
        {
            id: "cohere-command",
            provider: "cohere",
            model: "command",
            apiKey: cohereKey,
            rpmLimit: 60,
            tpmLimit: 60000,
        },
    ],
}
