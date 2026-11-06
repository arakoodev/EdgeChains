export type Palm2TextModel = "text-bison-001" | "models/text-bison-001";
export type Palm2ChatModel = "chat-bison-001" | "models/chat-bison-001";
export type Palm2EmbeddingModel = "embedding-gecko-001" | "models/embedding-gecko-001";
export type Palm2Model = Palm2TextModel | Palm2ChatModel | Palm2EmbeddingModel | string;

export type Palm2HarmCategory =
    | "HARM_CATEGORY_DEROGATORY"
    | "HARM_CATEGORY_TOXICITY"
    | "HARM_CATEGORY_VIOLENCE"
    | "HARM_CATEGORY_SEXUAL"
    | "HARM_CATEGORY_MEDICAL"
    | "HARM_CATEGORY_DANGEROUS";

export type Palm2SafetyThreshold =
    | "BLOCK_NONE"
    | "BLOCK_ONLY_HIGH"
    | "BLOCK_MEDIUM_AND_ABOVE"
    | "BLOCK_LOW_AND_ABOVE";

export interface Palm2SafetySetting {
    category: Palm2HarmCategory;
    threshold: Palm2SafetyThreshold;
}

export interface Palm2SafetyRating {
    category: Palm2HarmCategory;
    probability: "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";
}

export interface Palm2ConstructionOptions {
    apiKey?: string;
    baseUrl?: string;
}

export interface Palm2Message {
    author?: string;
    content: string;
}

export interface Palm2Example {
    input: Palm2Message;
    output: Palm2Message;
}

export interface Palm2TextOptions {
    model?: Palm2TextModel | string;
    prompt: string;
    temperature?: number;
    candidateCount?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    safetySettings?: Palm2SafetySetting[];
    stopSequences?: string[];
    max_retry?: number;
    delay?: number;
}

export interface Palm2ChatOptions {
    model?: Palm2ChatModel | string;
    prompt?: string;
    messages?: Palm2Message[];
    context?: string;
    examples?: Palm2Example[];
    temperature?: number;
    candidateCount?: number;
    topP?: number;
    topK?: number;
    max_retry?: number;
    delay?: number;
}

export interface Palm2EmbeddingOptions {
    model?: Palm2EmbeddingModel | string;
    text: string;
    max_retry?: number;
    delay?: number;
}

export interface Palm2TextCandidate {
    output: string;
    safetyRatings?: Palm2SafetyRating[];
}

export interface Palm2GenerateTextResponse {
    candidates: Palm2TextCandidate[];
}

export interface Palm2GenerateMessageResponse {
    candidates: Palm2Message[];
    messages?: Palm2Message[];
}

export interface Palm2EmbeddingValue {
    value: number[];
}

export interface Palm2EmbedTextResponse {
    embedding: Palm2EmbeddingValue;
}
