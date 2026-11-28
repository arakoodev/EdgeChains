import { Endpoint } from "./Endpoint";

export class CohereEndpoint extends Endpoint {
    async chat(messages: any[]): Promise<any> {
          console.log(`Calling Cohere with model ${this.config.model}`);
          return {
                  provider: "cohere",
                  model: this.config.model,
                  choices: [{ message: { content: "Cohere response stub" } }]
          };
    }
}
