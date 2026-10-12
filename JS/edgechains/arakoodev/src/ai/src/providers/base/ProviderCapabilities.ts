import { ProviderCapabilities } from "../../core/types.js"

export const OPENAI_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  systemMessages: true,
  tools: true,
  images: true,
}

export const GEMINI_CAPABILITIES: ProviderCapabilities = {
  streaming: true,
  systemMessages: true,
  tools: false,
  images: true,
}

export const COHERE_CAPABILITIES: ProviderCapabilities = {
  streaming: false,
  systemMessages: true,
  tools: false,
  images: false,
}