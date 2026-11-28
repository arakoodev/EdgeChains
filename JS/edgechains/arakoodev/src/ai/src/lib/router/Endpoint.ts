import { ChatModel, Provider, EndpointConfig } from "../../types";

export abstract class Endpoint {
    protected config: EndpointConfig;

  constructor(config: EndpointConfig) {
        this.config = config;
  }

  abstract chat(messages: any[]): Promise<any>;

  getProvider(): Provider {
        return this.config.provider;
  }

  getModel(): ChatModel {
        return this.config.model;
  }
}
