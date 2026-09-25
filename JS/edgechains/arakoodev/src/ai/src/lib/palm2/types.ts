export type Palm2TextModel = "text-bison-001" | "text-bison" | (string & {});
export type Palm2ChatModel = "chat-bison-001" | "chat-bison" | (string & {});
export type Palm2EmbeddingModel = "embedding-gecko-001" | "textembedding-gecko-001" | (string & {});

export type Palm2HarmCategory =
    | "HARM_CATEGORY_UNSPECIFIED"
    | "HARM_CATEGORY_DEROGATORY"
    | "HARM_CATEGORY_TOXICITY"
    | "HARM_CATEGORY_VIOLENCE"
    | "HARM_CATEGORY_SEXUAL"
    | "HARM_CATEGORY_MEDICAL"
    | "HARM_CATEGORY_DANGEROUS";

export type Palm2HarmBlockThreshold =
    | "HARM_BLOCK_THRESHOLD_UNSPECIFIED"
    | "BLOCK_LOW_AND_ABOVE"
    | "BLOCK_MEDIUM_AND_ABOVE"
    | "BLOCK_ONLY_HIGH"
    | "BLOCK_NONE";

export type Palm2HarmProbability =
    "HARM_PROBABILITY_UNSPECIFIED" | "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";

export interface Palm2ConstructionOptions {
    apiKey?: string;
    baseUrl?: string;
    apiVersion?: string;
}

export interface Palm2SafetySetting {
    category: Palm2HarmCategory;
    threshold: Palm2HarmBlockThreshold;
}

export interface Palm2SafetyRating {
    category: Palm2HarmCategory | string;
    probability: Palm2HarmProbability | string;
}

export interface Palm2CitationSource {
    startIndex?: number;
    endIndex?: number;
    uri?: string;
    license?: string;
}

export interface Palm2CitationMetadata {
    citationSources?: Palm2CitationSource[];
}

export interface Palm2TextPrompt {
    text: string;
}

export interface Palm2Message {
    author?: string;
    content: string;
    citationMetadata?: Palm2CitationMetadata;
}

export interface Palm2Example {
    input: Palm2Message;
    output: Palm2Message;
}

export interface Palm2MessagePrompt {
    context?: string;
    examples?: Palm2Example[];
    messages: Palm2Message[];
}

export interface Palm2RetryOptions {
    max_retry?: number;
    delay?: number;
}

export interface Palm2GenerateTextOptions extends Palm2RetryOptions {
    model?: Palm2TextModel;
    prompt: string;
    temperature?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
    safetySettings?: Palm2SafetySetting[];
}

export interface Palm2ChatOptions extends Palm2RetryOptions {
    model?: Palm2ChatModel;
    prompt?: string;
    context?: string;
    examples?: Palm2Example[];
    messages?: Palm2Message[];
    temperature?: number;
    candidateCount?: number;
    topP?: number;
    topK?: number;
}

export interface Palm2GenerateMessageOptions extends Palm2ChatOptions {
    messages: Palm2Message[];
}

export interface Palm2EmbedTextOptions extends Palm2RetryOptions {
    model?: Palm2EmbeddingModel;
    text: string;
}

export interface Palm2BatchEmbedTextOptions extends Palm2RetryOptions {
    model?: Palm2EmbeddingModel;
    texts: string[];
}

export interface Palm2CountTextTokensOptions extends Palm2RetryOptions {
    model?: Palm2TextModel;
    prompt: string;
}

export interface Palm2ContentFilter {
    reason?: string;
    message?: string;
}

export interface Palm2TextCandidate {
    output: string;
    safetyRatings?: Palm2SafetyRating[];
    citationMetadata?: Palm2CitationMetadata;
}

export interface Palm2GenerateTextResponse {
    candidates?: Palm2TextCandidate[];
    filters?: Palm2ContentFilter[];
    safetyFeedback?: Array<{
        rating?: Palm2SafetyRating;
        setting?: Palm2SafetySetting;
    }>;
}

export interface Palm2GenerateMessageResponse {
    candidates?: Palm2Message[];
    messages?: Palm2Message[];
    filters?: Palm2ContentFilter[];
}

export interface Palm2Embedding {
    value?: number[];
    values?: number[];
}

export interface Palm2EmbedTextResponse {
    embedding?: Palm2Embedding;
}

export interface Palm2BatchEmbedTextResponse {
    embeddings?: Palm2Embedding[];
}

export interface Palm2CountTextTokensResponse {
    tokenCount?: number;
}
