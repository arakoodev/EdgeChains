local SmartRouter(deployments, strategy="least-tokens") = {
    deployments: deployments,
    strategy: strategy,
    timeout: 30000,
    retries: 3,
};

{
    // Example usage
    router: SmartRouter([
        { id: "oa1", provider: "openai", model: "gpt-3.5-turbo", apiKey: "SK_OPENAI_1" },
        { id: "g1", provider: "google", model: "gemini-pro", apiKey: "SK_GOOGLE_1" }
    ])
}
