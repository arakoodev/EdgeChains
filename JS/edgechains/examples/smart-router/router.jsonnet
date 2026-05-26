local openai_key = std.extVar("OPENAI_API_KEY");
local gemini_key = std.extVar("GEMINI_API_KEY");
local cohere_key = std.extVar("COHERE_API_KEY");

{
    strategy: "least-tokens",
    deployments: [
        {
            provider: "openai",
            api_key: openai_key,
            model: "gpt-3.5-turbo",
            rpm_limit: 60,
            tpm_limit: 10000,
        },
        {
            provider: "openai",
            api_key: openai_key,
            model: "gpt-4",
            rpm_limit: 30,
            tpm_limit: 5000,
        },
        {
            provider: "gemini",
            api_key: gemini_key,
            model: "gemini-pro",
            rpm_limit: 60,
        },
        {
            provider: "cohere",
            api_key: cohere_key,
            model: "command",
            rpm_limit: 30,
        },
    ],
}
