local openaiKeyPrimary = std.extVar('openai_key_primary');
local openaiKeyBackup = std.extVar('openai_key_backup');
local palmKey = std.extVar('palm_key');
local cohereKey = std.extVar('cohere_key');

{
    deployments: [
        {
            id: 'openai-primary',
            modelName: 'gpt-3.5-turbo',
            provider: 'openai',
            model: 'gpt-3.5-turbo',
            apiKey: openaiKeyPrimary,
            rpm: 2,
            tpm: 5000,
        },
        {
            id: 'openai-backup',
            modelName: 'gpt-3.5-turbo',
            provider: 'openai',
            model: 'gpt-3.5-turbo',
            apiKey: openaiKeyBackup,
            rpm: 10,
            tpm: 10000,
        },
        {
            id: 'palm-chat',
            modelName: 'chat-bison-001',
            provider: 'palm',
            model: 'chat-bison-001',
            apiKey: palmKey,
            rpm: 10,
            tpm: 10000,
        },
        {
            id: 'cohere-command',
            modelName: 'command',
            provider: 'cohere',
            model: 'command',
            apiKey: cohereKey,
            rpm: 10,
            tpm: 10000,
        },
    ],
    reliability: {
        timeout: 5000,
        numRetries: 2,
        retryDelayMs: 5,
        cooldownTimeMs: 2000,
        fallbacks: [
            {
                'gpt-3.5-turbo': ['chat-bison-001', 'command'],
            },
        ],
    },
    logging: {
        callbacks: ['sentry', 'posthog'],
        sentry: {
            dsn: 'https://publickey123@o1.ingest.sentry.io/456',
            environment: 'test',
        },
        posthog: {
            apiKey: 'phc_test_key_123',
            host: 'https://app.posthog.com',
            distinctId: 'edgechains-router-test',
        },
    },
}
