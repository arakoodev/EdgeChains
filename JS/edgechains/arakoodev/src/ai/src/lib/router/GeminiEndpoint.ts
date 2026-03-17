import { Endpoint } from "./Endpoint";

export class GeminiEndpoint extends Endpoint {
    async chat(messages: any[]): Promise<any> {
          console.log(`Calling Gemini with model ${this.config.model}`);
          return {
                  provider: "google",
                  model: this.config.model,
                  choices: [{ message: { content: "Gemini response stub" } }]
          };
    }
}
