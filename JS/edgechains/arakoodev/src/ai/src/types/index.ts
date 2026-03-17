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
  | "gemini-1.5-pro-latest"
  | "gemini-1.5-flash-latest"
  | "gemini-pro"
  | "gemini-pro-vision"
  | "command-r-plus"
  | "command-r"
  | "mistral-large-latest"
  | "mistral-small-latest"
  | "claude-3-opus-20240229"
  | "claude-3-sonnet-20240229"
  | "claude-3-haiku-20240307";

export type Provider = "openai" | "google" | "cohere" | "anthropic" | "mistral";

export interface EndpointConfig {
      apiKey: string;
      baseUrl?: string;
      model: ChatModel;
      provider: Provider;
}
