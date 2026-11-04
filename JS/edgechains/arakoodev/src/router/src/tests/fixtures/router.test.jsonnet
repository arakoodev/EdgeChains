// EdgeChains router configuration. This is plain JSON (valid jsonnet); use
// std.extVar / secrets.jsonnet for real deployments, as in the examples.
{
    "routing_strategy": "least-tokens",
    "timeout": 60000,
    "num_retries": 2,
    "allowed_fails": 0,
    "cooldown_time": 60000,
    "success_callback": ["posthog"],
    "failure_callback": ["sentry"],
    "model_list": [
        {
            "model_name": "gpt-3.5-turbo",
            "litellm_params": {
                "model": "openai/gpt-3.5-turbo",
                "api_key": "sk-your-key-here",
                "api_base": "https://api.openai.com/v1"
            },
            "rpm": 100,
            "tpm": 100000
        },
        {
            "model_name": "chat-bison",
            "litellm_params": {
                "model": "palm/chat-bison-001",
                "api_key": "your-palm-api-key",
                "api_base": "https://generativelanguage.googleapis.com/v1beta2"
            }
        },
        {
            "model_name": "command",
            "litellm_params": {
                "model": "cohere/command",
                "api_key": "your-cohere-api-key",
                "api_base": "https://api.cohere.ai/v1"
            }
        }
    ],
    "fallbacks": { "gpt-4": ["gpt-3.5-turbo"] }
}
