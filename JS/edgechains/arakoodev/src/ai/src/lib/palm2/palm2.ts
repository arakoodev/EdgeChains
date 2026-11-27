import axios from "axios";
import { retry } from "@lifeomic/attempt";

interface Palm2AIConstructionOptions {
  apiKey?: string;
}

interface messageOption {
  author?: string;
  content: string;
}

interface Palm2AIChatOptions {
  model?: string;
  context?: string;
  examples?: { input: messageOption; output: messageOption }[];
  prompt: string;
  temperature?: number;
  max_output_tokens?: number;
  max_retry?: number;
  delay?: number;
}

export class Palm2AI {
  apiKey: string;

  constructor(options: Palm2AIConstructionOptions = {}) {
    this.apiKey = options.apiKey || process.env.PALM2_API_KEY || "";
  }

  async chat(chatOptions: Palm2AIChatOptions) {
    const model = chatOptions.model || "chat-bison-001";
    const url = `https://generativelanguage.googleapis.com/v1beta3/models/${model}:generateMessage?key=${this.apiKey}`;

    const requestBody = {
      prompt: {
        context: chatOptions.context,
        examples: chatOptions.examples,
        messages: [
          {
            content: chatOptions.prompt,
          },
        ],
      },
      temperature: chatOptions.temperature ?? 0.7,
      candidateCount: 1,
    };

    const config = {
      headers: {
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
