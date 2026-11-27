export type ChatModel =
    | "gpt-4o"
    | "gpt-4o-2024-05-13"
    | "gpt-4-turbo"
    | "gpt-4-turbo-2024-04-09"
    | "gpt-4-0125-preview"
    | "gpt-4-turbo-preview"
    | "gpt-4-1106-preview"
    | "gpt-4-vision-preview"
    | "gpt-4"
    | "gpt-4-0314"
    | "gpt-4-0613"
    | "gpt-4-32k"
    | "gpt-4-32k-0314"
    | "gpt-4-32k-0613"
    | "gpt-3.5-turbo"
    | "gpt-3.5-turbo-16k"
    | "gpt-3.5-turbo-0301"
    | "gpt-3.5-turbo-0613"
    | "gpt-3.5-turbo-1106"
    | "gpt-3.5-turbo-0125"
    | "gpt-3.5-turbo-16k-0613";

export type role = "user" | "assistant" | "system";

export type Palm2TextModel =
    | "text-bison-001"
    | "models/text-bison-001"
    | "gemini-pro"
    | "gemini-1.5-pro"
    | "gemini-1.5-flash"
    | (string & {});

export type Palm2ChatModel =
    | "chat-bison-001"
    | "models/chat-bison-001"
    | "gemini-pro"
    | "gemini-1.5-pro"
    | "gemini-1.5-flash"
    | (string & {});

export type Palm2EmbeddingModel =
    "embedding-gecko-001" | "models/embedding-gecko-001" | "embedding-001" | (string & {});

export type Palm2HarmCategory =
    | "HARM_CATEGORY_UNSPECIFIED"
    | "HARM_CATEGORY_DEROGATORY"
    | "HARM_CATEGORY_TOXICITY"
    | "HARM_CATEGORY_VIOLENCE"
    | "HARM_CATEGORY_SEXUAL"
    | "HARM_CATEGORY_MEDICAL"
    | "HARM_CATEGORY_DANGEROUS"
    | "HARM_CATEGORY_HARASSMENT"
    | "HARM_CATEGORY_HATE_SPEECH"
    | "HARM_CATEGORY_SEXUALLY_EXPLICIT"
    | "HARM_CATEGORY_DANGEROUS_CONTENT";

export type Palm2SafetyThreshold =
    | "HARM_BLOCK_THRESHOLD_UNSPECIFIED"
    | "BLOCK_LOW_AND_ABOVE"
    | "BLOCK_MEDIUM_AND_ABOVE"
    | "BLOCK_ONLY_HIGH"
    | "BLOCK_NONE";

export type Palm2HarmProbability =
    "HARM_PROBABILITY_UNSPECIFIED" | "NEGLIGIBLE" | "LOW" | "MEDIUM" | "HIGH";

export interface Palm2SafetySetting {
    category: Palm2HarmCategory;
    threshold: Palm2SafetyThreshold;
}

export interface Palm2SafetyRating {
    category: Palm2HarmCategory;
    probability: Palm2HarmProbability;
    blocked?: boolean;
}

export interface Palm2CitationSource {
    startIndex?: number;
    endIndex?: number;
    uri?: string;
    license?: string;
}

export interface Palm2CitationMetadata {
    citationSources: Palm2CitationSource[];
}

export interface Palm2Message {
    author?: string;
    role?: role | string;
    content: string;
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

export interface Palm2TextCandidate {
    output: string;
    safetyRatings?: Palm2SafetyRating[];
    citationMetadata?: Palm2CitationMetadata;
}

export interface Palm2ContentFilter {
    reason: string;
    message?: string;
}

export interface Palm2GenerateTextResponse {
    candidates: Palm2TextCandidate[];
    filters?: Palm2ContentFilter[];
    safetyFeedback?: any[];
}

export interface Palm2GenerateMessageResponse {
    candidates: Palm2Message[];
    messages?: Palm2Message[];
    filters?: Palm2ContentFilter[];
}

export interface Palm2Embedding {
    value: number[];
}

export interface Palm2EmbeddingResponse {
    embedding: Palm2Embedding;
}
