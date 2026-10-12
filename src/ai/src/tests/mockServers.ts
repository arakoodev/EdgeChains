/**
 * Mock Servers — msw-based HTTP handlers for testing the SmartRouter
 *
 * Provides configurable mock endpoints for OpenAI, Gemini, and Cohere
 * that can return success responses, 429 rate limits, or 500 errors.
 */

import { http, HttpResponse } from "msw";

// ─── Response Factories ──────────────────────────────────────────────────────

export function createOpenAISuccessResponse(content: string = "Hello from OpenAI") {
    return {
        choices: [
            {
                message: {
                    role: "assistant",
                    content,
                },
                index: 0,
                finish_reason: "stop",
            },
        ],
        usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
        },
    };
}

export function createGeminiSuccessResponse(content: string = "Hello from Gemini") {
    return {
        candidates: [
            {
                content: {
                    parts: [{ text: content }],
                    role: "model",
                },
                finishReason: "STOP",
                index: 0,
                safetyRatings: [],
            },
        ],
        usageMetadata: {
            promptTokenCount: 8,
            candidatesTokenCount: 15,
            totalTokenCount: 23,
        },
    };
}

export function createCohereSuccessResponse(content: string = "Hello from Cohere") {
    return {
        message: {
            content: [{ type: "text", text: content }],
        },
        usage: {
            tokens: {
                input_tokens: 12,
                output_tokens: 18,
            },
        },
    };
}

// ─── Mock Handler Builders ───────────────────────────────────────────────────

/**
 * Create OpenAI chat completion handler.
 * Pass `status` to simulate errors (e.g., 429, 500).
 */
export function openAIChatHandler(
    options: { status?: number; response?: any; delay?: number } = {}
) {
    return http.post("https://api.openai.com/v1/chat/completions", async () => {
        if (options.delay) {
            await new Promise((r) => setTimeout(r, options.delay));
        }
        const status = options.status || 200;
        const body = options.response || createOpenAISuccessResponse();

        if (status === 429) {
            return HttpResponse.json(
                { error: { message: "Rate limit exceeded", type: "rate_limit_error" } },
                { status: 429, headers: { "retry-after": "60" } }
            );
        }
        if (status >= 500) {
            return HttpResponse.json(
                { error: { message: "Internal server error" } },
                { status }
            );
        }
        return HttpResponse.json(body, { status });
    });
}

/**
 * Create Gemini generateContent handler.
 */
export function geminiChatHandler(
    options: { status?: number; response?: any; delay?: number } = {}
) {
    return http.post(
        "https://generativelanguage.googleapis.com/v1/models/:model\\::action",
        async () => {
            if (options.delay) {
                await new Promise((r) => setTimeout(r, options.delay));
            }
            const status = options.status || 200;
            const body = options.response || createGeminiSuccessResponse();

            if (status === 429) {
                return HttpResponse.json(
                    { error: { message: "RESOURCE_EXHAUSTED" } },
                    { status: 429, headers: { "retry-after": "60" } }
                );
            }
            if (status >= 500) {
                return HttpResponse.json(
                    { error: { message: "Internal server error" } },
                    { status }
                );
            }
            return HttpResponse.json(body, { status });
        }
    );
}

/**
 * Create Cohere chat handler.
 */
export function cohereChatHandler(
    options: { status?: number; response?: any; delay?: number } = {}
) {
    return http.post("https://api.cohere.com/v2/chat", async () => {
        if (options.delay) {
            await new Promise((r) => setTimeout(r, options.delay));
        }
        const status = options.status || 200;
        const body = options.response || createCohereSuccessResponse();

        if (status === 429) {
            return HttpResponse.json(
                { message: "too many requests" },
                { status: 429, headers: { "retry-after": "60" } }
            );
        }
        if (status >= 500) {
            return HttpResponse.json(
                { message: "internal error" },
                { status }
            );
        }
        return HttpResponse.json(body, { status });
    });
}

// ─── Pre-built Handler Sets ──────────────────────────────────────────────────

/**
 * All providers succeed.
 */
export function allSuccessHandlers() {
    return [openAIChatHandler(), geminiChatHandler(), cohereChatHandler()];
}

/**
 * OpenAI returns 429, Gemini and Cohere succeed.
 */
export function openAIRateLimitedHandlers() {
    return [
        openAIChatHandler({ status: 429 }),
        geminiChatHandler(),
        cohereChatHandler(),
    ];
}

/**
 * OpenAI returns 500 (will be retried), Gemini succeeds.
 */
export function openAIServerErrorHandlers() {
    return [
        openAIChatHandler({ status: 500 }),
        geminiChatHandler(),
        cohereChatHandler(),
    ];
}

/**
 * All providers fail.
 */
export function allFailHandlers() {
    return [
        openAIChatHandler({ status: 500 }),
        geminiChatHandler({ status: 500 }),
        cohereChatHandler({ status: 500 }),
    ];
}
