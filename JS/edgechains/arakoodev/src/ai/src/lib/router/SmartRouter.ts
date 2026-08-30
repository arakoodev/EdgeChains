import axios, { AxiosInstance, AxiosResponse } from 'axios';

// --- Interfaces ---

export type ProviderType = 'openai' | 'cohere' | 'palm' | 'azure';

export interface ModelDeployment {
  id: string;
  provider: ProviderType;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface RouterConfig {
  deployments: ModelDeployment[];
  strategy?: 'round-robin' | 'least-used';
}

// Tokenlar hisobi uchun
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// --- Smart Router Class ---

export class SmartRouter {
  private deployments: ModelDeployment[];
  private client: AxiosInstance;
  private currentDeploymentIndex: number = 0;

  constructor(config: RouterConfig) {
    if (!config.deployments || config.deployments.length === 0) {
      throw new Error("SmartRouter: No deployments provided!");
    }
    this.deployments = config.deployments;
    this.client = axios.create();
    this.setupInterceptors();
  }

  // --- Helpers ---

  private getNextDeployment(): ModelDeployment {
    const deployment = this.deployments[this.currentDeploymentIndex];
    this.currentDeploymentIndex = (this.currentDeploymentIndex + 1) % this.deployments.length;
    return deployment;
  }

  // Loglarni yuborish (Sentry / Posthog mock)
  private logEvent(type: 'success' | 'error', data: any) {
    // Bu yerda real loyihada Sentry.captureMessage() yoki Posthog.capture() bo'ladi
    // Hozircha konsolga chiroyli qilib chiqaramiz
    const timestamp = new Date().toISOString();
    if (type === 'success') {
        console.log(`[📊 Analytics] ${timestamp} | Model: ${data.model} | Tokens: ${data.usage?.total_tokens || 0} | Cost: $${data.estimatedCost || 0}`);
    } else {
        console.log(`[🚨 Error Log] ${timestamp} | Provider: ${data.provider} | Status: ${data.status}`);
    }
  }

  private setupInterceptors() {
    // REQUEST
    this.client.interceptors.request.use((config) => {
      const deployment = this.getNextDeployment();
      
      config.headers['Authorization'] = `Bearer ${deployment.apiKey}`;
      config.headers['Content-Type'] = 'application/json';

      if (deployment.baseUrl) {
        config.baseURL = deployment.baseUrl;
      } else {
        switch (deployment.provider) {
          case 'openai': config.baseURL = 'https://api.openai.com/v1'; break;
          case 'cohere': config.baseURL = 'https://api.cohere.ai/v1'; break;
          default: config.baseURL = 'https://api.openai.com/v1'; 
        }
      }

      (config as any).metadata = { 
        deploymentId: deployment.id,
        provider: deployment.provider,
        model: deployment.model,
        startTime: Date.now(),
        retryCount: (config as any).retryCount || 0
      };

      if (config.data && typeof config.data === 'object') {
        config.data.model = deployment.model;
      }

      return config;
    });

    // RESPONSE
    this.client.interceptors.response.use(
      (response) => {
        const metadata = (response.config as any).metadata;
        const duration = Date.now() - metadata.startTime;
        
        // 1. Token Usage ni olish (OpenAI standarti)
        const usage: TokenUsage = response.data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        
        // 2. Log yozish (Analytics)
        this.logEvent('success', {
            model: metadata.model,
            provider: metadata.provider,
            usage: usage,
            duration: duration + 'ms'
        });

        return response;
      },
      async (error) => {
        const config = error.config;
        if (!config) return Promise.reject(error);

        const retryCount = config.retryCount || 0;
        const maxRetries = this.deployments.length; 
        const shouldRetry = error.response?.status === 429 || error.response?.status >= 500 || error.response?.status === 401;

        // Xatoni log qilish
        this.logEvent('error', {
            provider: config.metadata?.provider,
            status: error.response?.status,
            message: error.message
        });

        if (shouldRetry && retryCount < maxRetries) {
            console.warn(`[SmartRouter] ⚠️ Switching provider... (Attempt ${retryCount + 1}/${maxRetries})`);
            config.retryCount = retryCount + 1;
            return this.client.request(config);
        }
        
        return Promise.reject(error);
      }
    );
  }

  public async chat(payload: any): Promise<AxiosResponse> {
    return this.client.post('/chat/completions', payload);
  }
}