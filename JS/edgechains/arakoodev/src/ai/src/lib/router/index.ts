/**
 * Smart Router barrel export.
 */

export { LLMRouter } from "./router.js";
export { RouterLogger } from "./logging.js";
export {
    OpenAIProvider,
    GeminiProvider,
    CohereProvider,
} from "./providers/index.js";

// Re-export all types
export type {
    LLMProvider,
    ChatRole,
    ChatMessage,
    DeploymentConfig,
    RouterConfig,
    LoadBalanceStrategy,
    RouterChatOptions,
    RouterChatResponse,
    TokenUsage,
    StreamChunk,
    ILLMProvider,
    ProviderChatRequest,
    ProviderChatResponse,
    LoggingConfig,
    RouterEvent,
    RouterEventHandler,
    DeploymentState,
} from "./types.js";
