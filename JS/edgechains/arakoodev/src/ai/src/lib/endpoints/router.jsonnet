local openaiKey = std.extVar("openai_api_key");
local palmKey = std.extVar("palm_api_key");
local cohereKey = std.extVar("cohere_api_key");

{
    timeout: 5000,
    numRetries: 2,
    retryDelay: 50,
    success_callback: ["posthog", "sentry"],
    failure_callback: ["sentry", "posthog"],
    deployments: [
        {
            id: "openai-gpt35",
            provider: "openai",
            model: "gpt-3.5-turbo",
            apiKey: openaiKey,
            rpmLimit: 100,
            tpmLimit: 90000
        },
        {
            id: "google-palm-bison",
            provider: "palm",
            model: "text-bison-001",
            apiKey: palmKey,
            rpmLimit: 60,
            tpmLimit: 60000
        },
        {
            id: "cohere-command",
            provider: "cohere",
            model: "command",
            apiKey: cohereKey,
            rpmLimit: 100,
            tpmLimit: 100000
        }
    ]
}
