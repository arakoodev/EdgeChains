{
    "maxRetries": 3,
    "retryDelayMs": 100,
    "timeoutMs": 20000,
    "cooldownMs": 15000,
    "deployments": [
        {
            "id": "openai-primary",
            "provider": "openai",
            "model": "gpt-3.5-turbo",
            "rpmLimit": 100,
            "tpmLimit": 120000
        },
        {
            "id": "palm-backup",
            "provider": "palm",
            "model": "chat-bison-001",
            "rpmLimit": 60,
            "tpmLimit": 60000
        },
        {
            "id": "cohere-fallback",
            "provider": "cohere",
            "model": "command",
            "rpmLimit": 100,
            "tpmLimit": 100000
        }
    ]
}
