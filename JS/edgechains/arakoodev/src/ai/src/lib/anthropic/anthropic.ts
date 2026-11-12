import axios from "axios";
import { role } from "../../types/index.js";
import { retry } from "@lifeomic/attempt";

const url = "https://api.anthropic.com/v1/messages";

interface MessageOption {
  role: role | "assistant";
  content: string;
}

export interface AnthropicAIChatOptions {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  prompt?: string;
  messages?: MessageOption[];
  system?: string;
  max_retry?: number;
  delay?: number;
}

export interface AnthropicAIConstructionOptions {
  apiKey?: string;
}

export class AnthropicAI {
  apiKey: string;

  constructor(options: AnthropicAIConstructionOptions = {}) {
    this.apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY || "";
  }

  async chat(chatOptions: AnthropicAIChatOptions) {
    const model = chatOptions.model || "claude-3-5-sonnet-20240620";
    
    const requestBody = {
      model,
      max_tokens: chatOptions.max_tokens || 1024,
      messages: chatOptions.prompt
        ? [
            {
              role: "user",
              content: chatOptions.prompt,
            },
          ]
        : chatOptions.messages,
      system: chatOptions.system,
      temperature: chatOptions.temperature ?? 0.7,
    };

    const config = {
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
    };

    return await retry(
      async () => {
        const response = await axios.post(url, requestBody, config);
        return response.data;
      },
      {
        maxAttempts: chatOptions.max_retry || 3,
        delay: chatOptions.delay || 200,
      }
    );
  }
}
