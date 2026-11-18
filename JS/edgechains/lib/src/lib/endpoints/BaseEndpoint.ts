import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface BaseEndpointConfig {
    timeout?: number;
    headers?: Record<string, string>;
}

export abstract class BaseEndpoint {
    protected client: AxiosInstance;
    protected config: BaseEndpointConfig;

    constructor(config: BaseEndpointConfig = {}) {
        this.config = config;
        this.client = axios.create({
            timeout: config.timeout || 30000,
            headers: {
                'Content-Type': 'application/json',
                ...(config.headers || {}),
            },
        });
        this.setupInterceptors();
    }

    protected abstract setupInterceptors(): void;

    protected async executeRequest<T = any>(config: AxiosRequestConfig): Promise<T> {
        const response: AxiosResponse<T> = await this.client(config);
        return response.data;
    }
}
