// Routing config for the litellm-style Router, kept in jsonnet (the way
// Edgechains prefers to manage configuration). Add more deployments to load
// balance across providers/keys; the Router picks the one below its rate limit
// with the fewest tokens used.

local openai_api_key = std.extVar("openai_api_key");

{
    strategy: "usage-based",
    numRetries: 2,
    cooldownSeconds: 60,
    deployments: [
        {
            model: "gpt-3.5-turbo-0613",
            provider: "openai",
            apiKey: openai_api_key,
            rpm: 1000,
            tpm: 100000,
        },
    ],
}
