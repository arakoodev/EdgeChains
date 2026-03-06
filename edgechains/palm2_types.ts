// Palm2/Gemini API TypeScript Types
// For EdgeChains project

export interface Palm2Config {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}

export interface GenerationConfig {
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
}

export interface ContentPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface Content {
  role?: 'user' | 'model';
  parts: ContentPart[];
}

export interface Palm2Request {
  contents: Content[];
  generationConfig?: GenerationConfig;
  safetySettings?: SafetySetting[];
}

export interface SafetySetting {
  category: HarmCategory;
  threshold: HarmBlockThreshold;
}

export enum HarmCategory {
  HARM_CATEGORY_UNSPECIFIED = 'HARM_CATEGORY_UNSPECIFIED',
  HARM_CATEGORY_HATE_SPEECH = 'HARM_CATEGORY_HATE_SPEECH',
  HARM_CATEGORY_SEXUALLY_EXPLICIT = 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  HARM_CATEGORY_HARASSMENT = 'HARM_CATEGORY_HARASSMENT',
  HARM_CATEGORY_DANGEROUS_CONTENT = 'HARM_CATEGORY_DANGEROUS_CONTENT'
}

export enum HarmBlockThreshold {
  HARM_BLOCK_THRESHOLD_UNSPECIFIED = 'HARM_BLOCK_THRESHOLD_UNSPECIFIED',
  BLOCK_LOW_AND_ABOVE = 'BLOCK_LOW_AND_ABOVE',
  BLOCK_MEDIUM_AND_ABOVE = 'BLOCK_MEDIUM_AND_ABOVE',
  BLOCK_ONLY_HIGH = 'BLOCK_ONLY_HIGH',
  BLOCK_NONE = 'BLOCK_NONE'
}

export interface Palm2Candidate {
  content: Content;
  finishReason?: string;
  index?: number;
  safetyRatings?: SafetyRating[];
}

export interface SafetyRating {
  category: HarmCategory;
  probability: string;
}

export interface Palm2Response {
  candidates: Palm2Candidate[];
  promptFeedback?: PromptFeedback;
  usageMetadata?: UsageMetadata;
}

export interface PromptFeedback {
  blockReason?: string;
  safetyRatings?: SafetyRating[];
}

export interface UsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

export interface EmbeddingRequest {
  content: Content;
  taskType?: TaskType;
  title?: string;
}

export enum TaskType {
  TASK_TYPE_UNSPECIFIED = 'TASK_TYPE_UNSPECIFIED',
  RETRIEVAL_QUERY = 'RETRIEVAL_QUERY',
  RETRIEVAL_DOCUMENT = 'RETRIEVAL_DOCUMENT',
  SEMANTIC_SIMILARITY = 'SEMANTIC_SIMILARITY',
  CLASSIFICATION = 'CLASSIFICATION',
  CLUSTERING = 'CLUSTERING'
}

export interface EmbeddingResponse {
  embedding: {
    values: number[];
  };
}

export interface BatchEmbeddingRequest {
  requests: EmbeddingRequest[];
}

export interface BatchEmbeddingResponse {
  embeddings: {
    values: number[];
  }[];
}

export interface TokenCountRequest {
  contents: Content[];
}

export interface TokenCountResponse {
  totalTokens: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export interface ModelInfo {
  name: string;
  version: string;
  displayName: string;
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  supportedGenerationMethods: string[];
  temperature?: number;
  topP?: number;
  topK?: number;
}

export interface ListModelsResponse {
  models: ModelInfo[];
}
