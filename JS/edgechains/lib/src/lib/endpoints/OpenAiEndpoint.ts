import { OpenAIApi } from 'openai';
import { SmartRouter, ModelProvider, RequestConfig } from '../smart-router/SmartRouter';
import { ModelCapability } from '../smart-router/types';

/**
 * @deprecated This endpoint is being migrated to SmartRouter. Use SmartRouter directly for new implementations.
 * Legacy support maintained for backward compatibility.
 */
export class OpenAiEndpoint {
  private smartRouter: SmartRouter;
  private openai?: OpenAIApi;
  
  constructor(
    private apiKey?: string,
    private baseURL?: string,
    private defaultModel: string = 'gpt-3.5-turbo'
  ) {
    // Initialize SmartRouter as the primary handler
    this.smartRouter = new SmartRouter();
    
    // Register OpenAI provider
    this.smartRouter.registerProvider({
      name: 'openai',
      type: ModelProvider.OPENAI,
      config: {
        apiKey: this.apiKey || process.env.OPENAI_API_KEY,
        baseURL: this.baseURL,
      },
      models: [
        { name: 'gpt-4', capabilities: [ModelCapability.CHAT, ModelCapability.FUNCTION_CALLING] },
        { name: 'gpt-4-turbo', capabilities: [ModelCapability.CHAT, ModelCapability.FUNCTION_CALLING] },
        { name: 'gpt-3.5-turbo', capabilities: [ModelCapability.CHAT, ModelCapability.FUNCTION_CALLING] },
        { name: 'text-davinci-003', capabilities: [ModelCapability.COMPLETION] },
        { name: 'text-embedding-ada-002', capabilities: [ModelCapability.EMBEDDING] },
      ]
    });

    // Legacy OpenAI client for backward compatibility
    if (this.apiKey) {
      this.openai = new OpenAIApi({
        apiKey: this.apiKey,
        baseURL: this.baseURL,
      });
    }
  }

  /**
   * @deprecated Use SmartRouter.route() instead
   */
  async createChatCompletion(params: any): Promise<any> {
    console.warn('OpenAiEndpoint.createChatCompletion is deprecated. Use SmartRouter.route() instead.');
    
    const config: RequestConfig = {
      model: params.model || this.defaultModel,
      messages: params.messages,
      temperature: params.temperature,
      maxTokens: params.max_tokens,
      stream: params.stream,
    };

    return this.smartRouter.route(config, ModelCapability.CHAT);
  }

  /**
   * @deprecated Use SmartRouter.route() instead
   */
  async createCompletion(params: any): Promise<any> {
    console.warn('OpenAiEndpoint.createCompletion is deprecated. Use SmartRouter.route() instead.');
    
    const config: RequestConfig = {
      model: params.model || 'text-davinci-003',
      prompt: params.prompt,
      temperature: params.temperature,
      maxTokens: params.max_tokens,
      stream: params.stream,
    };

    return this.smartRouter.route(config, ModelCapability.COMPLETION);
  }

  /**
   * @deprecated Use SmartRouter.route() instead
   */
  async createEmbedding(params: any): Promise<any> {
    console.warn('OpenAiEndpoint.createEmbedding is deprecated. Use SmartRouter.route() instead.');
    
    const config: RequestConfig = {
      model: params.model || 'text-embedding-ada-002',
      input: params.input,
    };

    return this.smartRouter.route(config, ModelCapability.EMBEDDING);
  }

  /**
   * Get the SmartRouter instance for advanced usage
   */
  getRouter(): SmartRouter {
    return this.smartRouter;
  }

  /**
   * @deprecated Direct OpenAI client access. Use SmartRouter instead.
   */
  getClient(): OpenAIApi | undefined {
    console.warn('Direct OpenAI client access is deprecated. Use getRouter() instead.');
    return this.openai;
  }

  /**
   * Route request through SmartRouter with automatic fallback
   */
  async route(config: RequestConfig, capability: ModelCapability): Promise<any> {
    return this.smartRouter.route(config, capability);
  }

  /**
   * Get available models from the router
   */
  async getAvailableModels(): Promise<string[]> {
    return this.smartRouter.getAvailableModels();
  }

  /**
   * Check if a model supports a specific capability
   */
  supportsCapability(model: string, capability: ModelCapability): boolean {
    return this.smartRouter.supportsCapability(model, capability);
  }
}