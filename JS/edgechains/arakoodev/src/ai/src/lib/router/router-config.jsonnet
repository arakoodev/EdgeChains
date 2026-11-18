/**
 * SmartRouter jsonnet configuration template
 * 
 * This file configures the SmartRouter with multiple LLM providers,
 * routing strategies, and fallback chains.
 */

// Default model configurations
local openai_models = [
    { model: "gpt-4o", weight: 2 },
    { model: "gpt-4-turbo", weight: 1 },
    { model: "gpt-3.5-turbo", weight: 3 },
];

local openrouter_models = [
    { model: "openrouter/auto", weight: 1 },
    { model: "anthropic/claude-3.5-sonnet", weight: 2 },
];

// Provider configurations
local providers = {
    openai: {
        base_url: "https://api.openai.com/v1/chat/completions",
        api_key_env: "OPENAI_API_KEY",
    },
    openrouter: {
        base_url: "https://openrouter.ai/api/v1/chat/completions",
        api_key_env: "OPENROUTER_API_KEY",
    },
    groq: {
        base_url: "https://api.groq.com/openai/v1/chat/completions",
        api_key_env: "GROQ_API_KEY",
    },
};

// Router configuration
{
    strategy: "fallback",
    retry_count: 3,
    retry_delay: 1000,
    cache_enabled: false,

    models: [
        {
            provider: "openai",
            model: "gpt-4o",
            base_url: providers.openai.base_url,
            weight: 2,
            fallback_models: ["gpt-4-turbo", "gpt-3.5-turbo"],
            max_tokens: 4096,
            temperature: 0.7,
        },
        {
            provider: "openai",
            model: "gpt-4-turbo",
            base_url: providers.openai.base_url,
            weight: 1,
            fallback_models: ["gpt-3.5-turbo"],
            max_tokens: 4096,
            temperature: 0.7,
        },
        {
            provider: "openrouter",
            model: "openrouter/auto",
            base_url: providers.openrouter.base_url,
            weight: 1,
            max_tokens: 4096,
            temperature: 0.7,
        },
    ],

    // Rate limiting per provider (requests per minute)
    rate_limits: {
        openai: 60,
        openrouter: 30,
        groq: 30,
    },

    // Health check settings
    health_check: {
        enabled: true,
        interval_ms: 30000,
        timeout_ms: 5000,
    },
}
