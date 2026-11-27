local openaiKey = std.extVar("openai_api_key");
local palmKey = std.extVar("palm_api_key");
local cohereKey = std.extVar("cohere_api_key");
local sentryDsn = std.extVar("sentry_dsn");
local posthogKey = std.extVar("posthog_api_key");

{
    routing_strategy: "least-tokens",
    num_retries: 2,
    retry_after: 25,
    timeout: 30000,
    cooldown_time: 60000,
    allowed_fails: 2,
    default_model: "default-llm",
    model_list: [
        {
            deployment_id: "openai-gpt35-primary",
            model_name: "default-llm",
            litellm_params: {
                model: "openai/gpt-3.5-turbo",
                api_key: openaiKey,
                rpm: 60,
                tpm: 90000,
                priority: 1,
                weight: 3,
            },
        },
        {
            deployment_id: "google-palm-bison",
            model_name: "default-llm",
            litellm_params: {
                model: "palm/text-bison-001",
                api_key: palmKey,
                rpm: 60,
                tpm: 120000,
                priority: 2,
                weight: 2,
            },
        },
        {
            deployment_id: "cohere-command-primary",
            model_name: "default-llm",
            litellm_params: {
                model: "cohere/command",
                api_key: cohereKey,
                rpm: 60,
                tpm: 100000,
                priority: 3,
                weight: 1,
            },
        },
        {
            deployment_id: "openai-gpt35-16k-fallback",
            model_name: "gpt-3.5-turbo-16k",
            litellm_params: {
                model: "openai/gpt-3.5-turbo-16k",
                api_key: openaiKey,
                rpm: 40,
                tpm: 160000,
                priority: 1,
                weight: 1,
            },
        },
        {
            deployment_id: "palm-2-dedicated",
            model_name: "palm-2",
            litellm_params: {
                model: "palm/text-bison-001",
                api_key: palmKey,
                rpm: 60,
                tpm: 120000,
                priority: 1,
                weight: 1,
            },
        },
        {
            deployment_id: "cohere-command-dedicated",
            model_name: "command",
            litellm_params: {
                model: "cohere/command",
                api_key: cohereKey,
                rpm: 60,
                tpm: 100000,
                priority: 1,
                weight: 1,
            },
        },
    ],
    fallbacks: [
        { "default-llm": ["palm-2", "command"] },
        { "gpt-3.5-turbo": ["palm-2", "command"] },
    ],
    context_window_fallbacks: [
        { "default-llm": ["gpt-3.5-turbo-16k"] },
        { "gpt-3.5-turbo": ["gpt-3.5-turbo-16k"] },
    ],
    callbacks: ["sentry", "posthog"],
    sentry: {
        dsn: sentryDsn,
        environment: "production",
        captureBreadcrumbsOnSuccess: true,
    },
    posthog: {
        api_key: posthogKey,
        host: "https://app.posthog.com",
        distinct_id: "edgechains-smart-router",
    },
}
