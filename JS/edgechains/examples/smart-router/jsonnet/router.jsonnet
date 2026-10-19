// SmartRouter Jsonnet configuration for EdgeChains JS
{
    "maxRetries": 2,
    "timeoutMs": 20000,
    "cooldownMs": 10000,
    "deployments": [
        {
            "id": "openai-gpt35",
            "provider": "openai",
            "model": "gpt-3.5-turbo",
            "rpmLimit": 60,
            "tpmLimit": 90000,
        },
        {
            "id": "google-palm",
            "provider": "palm",
            "model": "chat-bison-001",
            "rpmLimit": 60,
            "tpmLimit": 60000,
        },
        {
            "id": "cohere-command",
            "provider": "cohere",
            "model": "command",
            "rpmLimit": 60,
            "tpmLimit": 60000,
        },
    ],
}
