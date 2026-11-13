import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Sentry } from '@sentry/node';
import { PostHog } from 'posthog-node';

interface EndpointConfig {
  url: string;
  apiKey: string;
  model: string;
  maxRetries: number;
  timeout: number;
}

interface RequestOptions {
  maxRetries?: number;
  timeout?: number;
}

class SmartRouterEndpoint {
  private endpoints: EndpointConfig[];
  private currentEndpointIndex: number;
  private axiosInstance: AxiosInstance;
  private sentry: Sentry;
  private posthog: PostHog;
  
  constructor(endpoints: EndpointConfig[], sentryDsn: string, posthogKey: string) {
    this.endpoints = endpoints;
    this.currentEndpointIndex = 0;
    this.axiosInstance = axios.create();
    this.sentry = new Sentry(sentryDsn);
    this.posthog = new PostHog(posthogKey);
    
    this.setupInterceptors();
  }
  
  private setupInterceptors() {
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;
        if (!config || !config.retry) {
          return Promise.reject(error);
        }
        
        config.retryCount = config.retryCount || 0;
        if (config.retryCount >= config.retry) {
          return Promise.reject(error);
        }
        
        config.retryCount += 1;
        const delay = Math.pow(2, config.retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        
        return this.axiosInstance(config);
      }
    );
  }
  
  private async getNextEndpoint(): Promise<EndpointConfig> {
    const endpoint = this.endpoints[this.currentEndpointIndex];
    this.currentEndpointIndex = (this.currentEndpointIndex + 1) % this.endpoints.length;
    return endpoint;
  }
  
  private async makeRequest(
    method: string,
    path: string,
    data?: any,
    options?: RequestOptions
  ): Promise<AxiosResponse> {
    const endpoint = await this.getNextEndpoint();
    const config: AxiosRequestConfig = {
      method,
      url: `${endpoint.url}${path}`,
      headers: {
        'Authorization': `Bearer ${endpoint.apiKey}`,
        'Content-Type': 'application/json',
      },
      data,
      timeout: options?.timeout || endpoint.timeout,
      retry: options?.maxRetries || endpoint.maxRetries,
    };
    
    try {
      const response = await this.axiosInstance(config);
      this.logRequest(endpoint, method, path, response.status);
      return response;
    } catch (error) {
      this.sentry.captureException(error);
      throw error;
    }
  }
  
  private logRequest(endpoint: EndpointConfig, method: string, path: string, status: number) {
    this.posthog.capture({
      distinctId: endpoint.url,
      event: 'api_request',
      properties: {
        method,
        path,
        status,
        endpoint: endpoint.url,
      },
    });
  }
  
  async chatCompletion(
    messages: any[],
    options?: RequestOptions
  ): Promise<AxiosResponse> {
    return this.makeRequest('post', '/chat/completions', { messages }, options);
  }
  
  async generateEmbeddings(
    input: string,
    options?: RequestOptions
  ): Promise<AxiosResponse> {
    return this.makeRequest('post', '/embeddings', { input }, options);
  }
  
  async streamCompletion(
    messages: any[],
    options?: RequestOptions
  ): Promise<AxiosResponse> {
    const endpoint = await this.getNextEndpoint();
    const config: AxiosRequestConfig = {
      method: 'post',
      url: `${endpoint.url}/chat/completions`,
      headers: {
        'Authorization': `Bearer ${endpoint.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      data: { messages },
      responseType: 'stream',
      timeout: options?.timeout || endpoint.timeout,
      retry: options?.maxRetries || endpoint.maxRetries,
    };
    
    try {
      const response = await this.axiosInstance(config);
      this.logRequest(endpoint, 'post', '/chat/completions', response.status);
      return response;
    } catch (error) {
      this.sentry.captureException(error);
      throw error;
    }
  }
}

export default SmartRouterEndpoint;