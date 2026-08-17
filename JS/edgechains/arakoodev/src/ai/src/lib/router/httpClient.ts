// Default axios-backed HttpClient. Reliability (timeouts + retries on transient
// failures) is implemented with `axios.interceptors.response.use`, exactly as
// the issue suggests. The Router talks to the `HttpClient` interface, so tests
// inject a fake and never hit the network.

import axios, { AxiosInstance } from "axios";
import { HttpClient, HttpRequestConfig, HttpResponse } from "./types.js";

export class HttpError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
        super(message);
        this.name = "HttpError";
        this.status = status;
    }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function isTransient(error: any): boolean {
    if (!error?.response) return true; // network error / timeout
    const status = error.response.status;
    return status === 429 || (status >= 500 && status <= 599);
}

export interface AxiosHttpClientOptions {
    numRetries?: number;
    retryDelay?: number;
    timeout?: number;
}

export class AxiosHttpClient implements HttpClient {
    private instance: AxiosInstance;

    constructor(options: AxiosHttpClientOptions = {}) {
        const numRetries = options.numRetries ?? 2;
        const retryDelay = options.retryDelay ?? 200;
        this.instance = axios.create({ timeout: options.timeout ?? 600000 });

        // Transient-failure retry with exponential backoff.
        this.instance.interceptors.response.use(
            (response) => response,
            async (error) => {
                const config: any = error?.config;
                if (!config || !isTransient(error)) return Promise.reject(error);
                config.__retryCount = config.__retryCount ?? 0;
                if (config.__retryCount >= numRetries) return Promise.reject(error);
                config.__retryCount += 1;
                await sleep(retryDelay * 2 ** (config.__retryCount - 1));
                return this.instance(config);
            }
        );
    }

    async post(url: string, body: unknown, config: HttpRequestConfig): Promise<HttpResponse> {
        try {
            const res = await this.instance.post(url, body, {
                headers: config.headers,
                timeout: config.timeout,
                params: config.params,
            });
            return { status: res.status, data: res.data };
        } catch (error: any) {
            throw new HttpError(
                error?.response?.data?.error?.message || error?.message || "request failed",
                error?.response?.status
            );
        }
    }

    async *stream(
        url: string,
        body: unknown,
        config: HttpRequestConfig
    ): AsyncGenerator<string, void, unknown> {
        const res = await this.instance.post(url, body, {
            headers: config.headers,
            timeout: config.timeout,
            params: config.params,
            responseType: "stream",
        });
        let buffer = "";
        for await (const chunk of res.data as AsyncIterable<Buffer>) {
            buffer += chunk.toString("utf-8");
            let newlineIndex = buffer.indexOf("\n");
            while (newlineIndex !== -1) {
                const line = buffer.slice(0, newlineIndex);
                buffer = buffer.slice(newlineIndex + 1);
                if (line.trim()) yield line;
                newlineIndex = buffer.indexOf("\n");
            }
        }
        if (buffer.trim()) yield buffer;
    }
}
