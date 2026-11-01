import { Endpoint } from "./Endpoint";

export class OpenAIEndpoint extends Endpoint {
    async chat(messages: any[]): Promise<any> {
          console.log(`Calling OpenAI with model ${this.config.model}`);
          return {
                  provider: "openai",
                  model: this.config.model,
                  choices: [{ message: { content: "OpenAI response stub" } }]
          };
    }
}
