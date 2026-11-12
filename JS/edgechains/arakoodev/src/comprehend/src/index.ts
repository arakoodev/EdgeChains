export {
    AWSComprehendRedactor,
    ComprehendRedactor,
    AwsComprehendRedactor,
    chunkTextByBytes,
} from "./lib/AWSComprehendRedactor.js";
export { ComprehendRedactionChain } from "./lib/ComprehendRedactionChain.js";
export { ComprehendObservable } from "./lib/ComprehendObservable.js";
export type {
    AWSComprehendRedactorConfig,
    RedactionOptions,
    RedactionResult,
    RedactionMaskMode,
    PiiEntity,
    PiiEntityType,
    LanguageCode,
    ChatMessage,
    EndpointChatOptions,
    EndpointLike,
    RedactorInterface,
    ComprehendRedactionChainConfig,
    ComprehendClientLike,
} from "./lib/types.js";
