/**
 * generateResponse.cts — Helper for smart-router example.
 *
 * Creates a pre-configured LLMRouter instance with mock server URLs
 * for local testing without real API keys.
 */

import { LLMRouter } from "@arakoodev/edgechains.js/ai";
import type { RouterConfig } from "@arakoodev/edgechains.js/ai";

const MOCK_BASE_URL = "http://localhost:4010";

export function createMockRouter(): LLMRouter {
    return new LLMRouter({
        strategy: "least-busy",
        maxRetries: 2,
        trackTokenUsage: true,
        deployments: [
            {
                id: "mock-openai",
                provider: "openai",
                model: "gpt-4o",
                apiKey: "mock-key",
                baseUrl: `${MOCK_BASE_URL}/v1/chat/completions`,
                isFallback: false,
                healthy: true,
                weight: 3,
            },
            {
                id: "mock-gemini",
                provider: "gemini",
                model: "gemini-pro",
                apiKey: "mock-key",
                baseUrl: `${MOCK_BASE_URL}/v1`,
                isFallback: false,
                healthy: true,
                weight: 1,
            },
            {
                id: "mock-cohere",
                provider: "cohere",
                model: "command-r",
                apiKey: "mock-key",
                baseUrl: `${MOCK_BASE_URL}/v2/chat`,
                isFallback: false,
                healthy: true,
                weight: 1,
            },
            {
                id: "mock-openai-fallback",
                provider: "openai",
                model: "gpt-3.5-turbo",
                apiKey: "mock-key",
                baseUrl: `${MOCK_BASE_URL}/v1/chat/completions`,
                isFallback: true,
                healthy: true,
            },
        ],
    });
}
