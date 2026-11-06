// Smart Router routing configuration (issue #286).
// The Router picks, at every call, the deployment that is below its rate limit
// and has used the fewest total tokens; 429 responses cool a deployment down
// and traffic fails over to the next one automatically.
local openaiDep(name_, model_) = {
    name: name_,
    provider: 'openai',
    modelName: model_,
    apiKey: std.extVar('openai_api_key'),
    rpmLimit: 100,
};

{
    deployments: [
        openaiDep('gpt-35-primary', 'gpt-3.5-turbo'),
        openaiDep('gpt-35-secondary', 'gpt-3.5-turbo-16k'),
        {
            name: 'palm-bison',
            provider: 'palm',
            modelName: 'text-bison-001',
            apiKey: std.extVar('openai_api_key'),
        },
        {
            name: 'cohere-command',
            provider: 'cohere',
            modelName: 'command',
            apiKey: std.extVar('cohere_api_key'),
        },
    ],
    // reliability rules
    cooldownMs: 3000,
    maxRetries: 2,
    retryBackoffMs: 500,
    timeoutMs: 30000,
}
