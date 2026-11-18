// Routing config for the litellm-style Router, kept in jsonnet (the way
// Edgechains prefers to manage configuration). Add more deployments to load
// balance across providers/keys; the Router picks the one below its rate limit
// with the fewest tokens used. This example needs both a chat model (answers)
// and an embeddings model (vector search), so it declares one deployment each.

local openai_api_key = std.extVar("openai_api_key");

{
    strategy: "usage-based",
    numRetries: 2,
    cooldownSeconds: 60,
    deployments: [
        {
            model: "gpt-3.5-turbo",
            provider: "openai",
            apiKey: openai_api_key,
            rpm: 1000,
            tpm: 100000,
        },
        {
            model: "text-embedding-ada-002",
            provider: "openai",
            apiKey: openai_api_key,
            rpm: 1000,
            tpm: 1000000,
        },
    ],
}
