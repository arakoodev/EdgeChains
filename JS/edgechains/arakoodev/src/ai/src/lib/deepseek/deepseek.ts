import { OpenAI } from "../openai/openai.js";

export interface DeepSeekAIConstructionOptions {
  apiKey?: string;
}

export class DeepSeekAI extends OpenAI {
  constructor(options: DeepSeekAIConstructionOptions = {}) {
    super({
      apiKey: options.apiKey || process.env.DEEPSEEK_API_KEY || "",
      baseUrl: "https://api.deepseek.com",
    });
  }

  // DeepSeek is OpenAI-compatible, so it inherits all methods from OpenAI.
  // We just set the custom base URL in the constructor.
}
