import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { EventEmitter } from 'events';

export interface EndpointConfig {
  id: string;
  baseURL: string;
  apiKey?: string;
  weight?: number;
  maxConcurrentRequests?: number;
  timeout?: number;
  retryAttempts?: number;
  healthCheckEndpoint?: string;
  model?: string;
  provider?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface RequestMetrics {
  endpointId: string;
  startTime: number;
  endTime: number;
  duration: number;
  tokenUsage?: TokenUsage;
  success: boolean;
  error?: string;
  statusCode?: number;
}

export interface LoadBalancingStrategy {
  selectEndpoint(endpoints: EndpointConfig[], metrics: Map<string, RequestMetrics[]>): EndpointConfig | null;
}

export class RoundRobinStrategy implements LoadBalancingStrategy {
  private currentIndex = 0;

  selectEndpoint(endpoints: EndpointConfig[]): EndpointConfig | null {
    if (endpoints.length === 0) return null;
    const endpoint = endpoints[this.currentIndex % endpoints.length];
    this.currentIndex = (this.currentIndex + 1) % endpoints.length;
    return endpoint;
  }
}

export class WeightedRoundRobinStrategy implements LoadBalancingStrategy {
  private weightedEndpoints: EndpointConfig[] = [];
  private currentIndex = 0;

  selectEndpoint(endpoints: EndpointConfig[]): EndpointConfig | null {
    if (endpoints.length === 0) return null;
    
    if (this.weightedEndpoints.length === 0) {
      this.buildWeightedList(endpoints);
    }
    
    const endpoint = this.weightedEndpoints[this.currentIndex % this.weightedEndpoints.length];
    this.currentIndex = (this.currentIndex + 1) % this.weightedEndpoints.length;
    return endpoint;
  }

  private buildWeightedList(endpoints: EndpointConfig[]): void {
    this.weightedEndpoints = [];
    endpoints.forEach(endpoint => {
      const weight = endpoint.weight || 1;
      for (let i = 0; i < weight; i++) {
        this.weightedEndpoints.push(endpoint);
      }
    });
  }
}

export class LeastConnectionsStrategy implements LoadBalancingStrategy {
  private connectionCounts = new Map<string, number>();

  selectEndpoint(endpoints: EndpointConfig[]): EndpointConfig | null {
    if (endpoints.length === 0) return null;
    
    let selectedEndpoint = endpoints[0];
    let minConnections = this.connectionCounts.get(selectedEndpoint.id) || 0;
    
    endpoints.forEach(endpoint => {
      const connections = this.connectionCounts.get(endpoint.id) || 0;
      if (connections < minConnections) {
        minConnections = connections;
        selectedEndpoint = endpoint;
      }
    });
    
    return selectedEndpoint;
  }

  incrementConnections(endpointId: string): void {
    const current = this.connectionCounts.get(endpointId) || 0;
    this.connectionCounts.set(endpointId, current + 1);
  }

  decrementConnections(endpointId: string): void {
    const current = this.connectionCounts.get(endpointId) || 0;
    this.connectionCounts.set(endpointId, Math.max(0, current - 1));
  }
}

export class SmartRouter extends EventEmitter {
  private endpoints: Map<string, EndpointConfig> = new Map();
  private axiosInstances: Map<string, AxiosInstance> = new Map();
  private loadBalancingStrategy: LoadBalancingStrategy;
  private metrics: Map<string, RequestMetrics[]> = new Map();
  private healthStatus: Map<string, boolean> = new Map();
  private concurrentRequests: Map<string, number> = new Map();
  private retryDelays = [1000, 2000, 4000, 8000];
  private enableLogging = true;
  private enableMetrics = true;

  constructor(
    endpoints: EndpointConfig[] = [],
    loadBalancingStrategy: LoadBalancingStrategy = new RoundRobinStrategy()
  ) {
    super();
    this.loadBalancingStrategy = loadBalancingStrategy;
    
    endpoints.forEach(endpoint => {
      this.addEndpoint(endpoint);
    });

    this.startHealthChecks();
  }

  addEndpoint(config: EndpointConfig): void {
    this.endpoints.set(config.id, {
      weight: 1,
      maxConcurrentRequests: 10,
      timeout: 30000,
      retryAttempts: 3,
      ...config
    });

    const axiosInstance = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` })
      }
    });

    this.setupAxiosInterceptors(axiosInstance, config.id);
    this.axiosInstances.set(config.id, axiosInstance);
    this.healthStatus.set(config.id, true);
    this.concurrentRequests.set(config.id, 0);
    this.metrics.set(config.id, []);

    this.log(`Added endpoint: ${config.id} (${config.baseURL})`);
  }

  removeEndpoint(endpointId: string): void {
    this.endpoints.delete(endpointId);
    this.axiosInstances.delete(endpointId);
    this.healthStatus.delete(endpointId);
    this.concurrentRequests.delete(endpointId);
    this.metrics.delete(endpointId);
    
    this.log(`Removed endpoint: ${endpointId}`);
  }

  private setupAxiosInterceptors(axiosInstance: AxiosInstance, endpointId: string): void {
    // Request interceptor
    axiosInstance.interceptors.request.use(
      (config) => {
        const currentRequests = this.concurrentRequests.get(endpointId) || 0;
        this.concurrentRequests.set(endpointId, currentRequests + 1);
        
        if (this.loadBalancingStrategy instanceof LeastConnectionsStrategy) {
          this.loadBalancingStrategy.incrementConnections(endpointId);
        }

        config.metadata = {
          startTime: Date.now(),
          endpointId
        };

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    axiosInstance.interceptors.response.use(
      (response) => {
        this.handleResponseMetrics(response, endpointId, true);
        return response;
      },
      (error) => {
        this.handleResponseMetrics(error.response || {}, endpointId, false, error.message);
        return Promise.reject(error);
      }
    );
  }

  private handleResponseMetrics(
    response: AxiosResponse | any,
    endpointId: string,
    success: boolean,
    error?: string
  ): void {
    const currentRequests = this.concurrentRequests.get(endpointId) || 0;
    this.concurrentRequests.set(endpointId, Math.max(0, currentRequests - 1));
    
    if (this.loadBalancingStrategy instanceof LeastConnectionsStrategy) {
      this.loadBalancingStrategy.decrementConnections(endpointId);
    }

    if (!this.enableMetrics) return;

    const config = response.config;
    const startTime = config?.metadata?.startTime || Date.now();
    const endTime = Date.now();
    
    const metrics: RequestMetrics = {
      endpointId,
      startTime,
      endTime,
      duration: endTime - startTime,
      success,
      statusCode: response.status,
      ...(error && { error })
    };

    // Extract token usage if available
    if (response.data?.usage) {
      metrics.tokenUsage = {
        promptTokens: response.data.usage.prompt_tokens || 0,
        completionTokens: response.data.usage.completion_tokens || 0,
        totalTokens: response.data.usage.total_tokens || 0
      };
    }

    const endpointMetrics = this.metrics.get(endpointId) || [];
    endpointMetrics.push(metrics);
    
    // Keep only last 1000 metrics per endpoint
    if (endpointMetrics.length > 1000) {
      endpointMetrics.splice(0, endpointMetrics.length - 1000);
    }
    
    this.metrics.set(endpointId, endpointMetrics);

    this.emit('metrics', metrics);
    
    if (success) {
      this.log(`Request completed: ${endpointId} (${metrics.duration}ms)`);
    } else {
      this.log(`Request failed: ${endpointId} - ${error}`, 'error');
    }
  }

  async request(config: AxiosRequestConfig, options?: { 
    preferredEndpoint?: string;
    retryAttempts?: number;
    excludeEndpoints?: string[];
  }): Promise<AxiosResponse> {
    const availableEndpoints = this.getAvailableEndpoints(options?.excludeEndpoints);
    
    if (availableEndpoints.length === 0) {
      throw new Error('No available endpoints');
    }

    let selectedEndpoint: EndpointConfig | null = null;
    
    if (options?.preferredEndpoint && this.isEndpointAvailable(options.preferredEndpoint)) {
      selectedEndpoint = this.endpoints.get(options.preferredEndpoint) || null;
    } else {
      selectedEndpoint = this.loadBalancingStrategy.selectEndpoint(availableEndpoints, this.metrics);
    }

    if (!selectedEndpoint) {
      throw new Error('No endpoint selected by load balancing strategy');
    }

    const axiosInstance = this.axiosInstances.get(selectedEndpoint.id);
    if (!axiosInstance) {
      throw new Error(`Axios instance not found for endpoint: ${selectedEndpoint.id}`);
    }

    const retryAttempts = options?.retryAttempts ?? selectedEndpoint.retryAttempts ?? 3;
    
    return this.executeWithRetry(axiosInstance, config, selectedEndpoint.id, retryAttempts);
  }

  async stream(config: AxiosRequestConfig, options?: {
    preferredEndpoint?: string;
    onChunk?: (chunk: any) => void;
    onError?: (error: any) => void;
    onComplete?: () => void;
  }): Promise<void> {
    const streamConfig = {
      ...config,
      responseType: 'stream' as const,
      data: {
        ...config.data,
        stream: true
      }
    };

    const response = await this.request(streamConfig, {
      preferredEndpoint: options?.preferredEndpoint
    });

    return new Promise((resolve, reject) => {
      let buffer = '';
      
      response.data.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        lines.forEach(line => {
          if (line.trim().startsWith('data: ')) {
            const data = line.substring(6);
            if (data.trim() === '[DONE]') {
              options?.onComplete?.();
              resolve();
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              options?.onChunk?.(parsed);
            } catch (e) {
              // Skip invalid JSON
            }
          }
        });
      });

      response.data.on('error', (error: any) => {
        options?.onError?.(error);
        reject(error);
      });

      response.data.on('end', () => {
        options?.onComplete?.();
        resolve();
      });
    });
  }

  private async executeWithRetry(
    axiosInstance: AxiosInstance,
    config: AxiosRequestConfig,
    endpointId: string,
    retryAttempts: number,
    attemptNumber = 0
  ): Promise<AxiosResponse> {
    try {
      return await axiosInstance.request(config);
    } catch (error: any) {
      if (attemptNumber >= retryAttempts - 1) {
        this.healthStatus.set(endpointId, false);
        throw error;
      }

      const delay = this.retryDelays[Math.min(attemptNumber, this.retryDelays.length - 1)];
      this.log(`Retrying request to ${endpointId} in ${delay}ms (attempt ${attemptNumber + 1}/${retryAttempts})`);
      
      await this.sleep(delay);
      return this.executeWithRetry(axiosInstance, config, endpointId, retryAttempts, attemptNumber + 1);
    }
  }

  private getAvailableEndpoints(excludeEndpoints: string[] = []): EndpointConfig[] {
    return Array.from(this.endpoints.values()).filter(endpoint => {
      if (excludeEndpoints.includes(endpoint.id)) return false;
      if (!this.healthStatus.get(endpoint.id)) return false;
      
      const currentRequests = this.concurrentRequests.get(endpoint.id) || 0;
      return currentRequests < (endpoint.maxConcurrentRequests || 10);
    });
  }

  private isEndpointAvailable(endpointId: string): boolean {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) return false;
    if (!this.healthStatus.get(endpointId)) return false;
    
    const currentRequests = this.concurrentRequests.get(endpointId) || 0;
    return currentRequests < (endpoint.maxConcurrentRequests || 10);
  }

  private startHealthChecks(): void {
    setInterval(async () => {
      for (const [endpointId, config] of this.endpoints) {
        try {
          const axiosInstance = this.axiosInstances.get(endpointId);
          if (!axiosInstance) continue;

          const healthEndpoint = config.healthCheckEndpoint || '/health';
          await axiosInstance.get(healthEndpoint, { timeout: 5000 });
          
          if (!this.healthStatus.get(endpointId)) {
            this.log(`Endpoint ${endpointId} is back online`);
          }
          this.healthStatus.set(endpointId, true);
        } catch (error) {
          if (this.healthStatus.get(endpointId)) {
            this.log(`Endpoint ${endpointId} is offline`, 'error');
          }
          this.healthStatus.set(endpointId, false);
        }
      }
    }, 30000); // Health check every 30 seconds
  }

  getMetrics(endpointId?: string): RequestMetrics[] {
    if (endpointId) {
      return this.metrics.get(endpointId) || [];
    }
    
    const allMetrics: RequestMetrics[] = [];
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics);
    }
    return allMetrics;
  }

  getTokenUsage(endpointId?: string): TokenUsage {
    const metrics = this.getMetrics(endpointId);
    return metrics.reduce(
      (total, metric) => {
        if (metric.tokenUsage) {
          total.promptTokens += metric.tokenUsage.promptTokens;
          total.completionTokens += metric.tokenUsage.completionTokens;
          total.totalTokens += metric.tokenUsage.totalTokens;
        }
        return total;
      },
      { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    );
  }

  getHealthStatus(): Map<string, boolean> {
    return new Map(this.healthStatus);
  }

  getConcurrentRequests(): Map<string, number> {
    return new Map(this.concurrentRequests);
  }

  setLoadBalancingStrategy(strategy: LoadBalancingStrategy): void {
    this.loadBalancingStrategy = strategy;
  }

  enableRequestLogging(enable = true): void {
    this.enableLogging = enable;
  }

  enableMetricsCollection(enable = true): void {
    this.enableMetrics = enable;
  }

  private log(message: string, level: 'info' | 'error' = 'info'): void {
    if (!this.enableLogging) return;
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] SmartRouter: ${message}`;
    
    if (level === 'error') {
      console.error(logMessage);
    } else {
      console.log(logMessage);
    }
    
    this.emit('log', { timestamp, level, message });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  destroy(): void {
    this.removeAllListeners();
    this.endpoints.clear();
    this.axiosInstances.clear();
    this.metrics.clear();
    this.healthStatus.clear();
    this.concurrentRequests.clear();
  }
}