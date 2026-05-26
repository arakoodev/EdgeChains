import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ChatRequest, TokenUsage, StreamChunk, ProviderType } from './types';

interface ProviderResponse {
    content: string;
    usage: TokenUsage;
    model: string;
}

interface StreamCallbacks {
    onChunk: (chunk: StreamChunk) => void;
    onDone: (usage?: TokenUsage) => void;
    onError: (error: Error) => void;
}

export class OpenAIProvider {
    private client: AxiosInstance;
    private orgId: string;

    constructor(apiKey: string, baseUrl?: string, orgId?: string) {
        this.client = axios.create({
            baseURL: baseUrl || 'https://api.openai.com/v1',
            headers: {
                'Authorization': 'Bearer ' + apiKey,
                'Content-Type': 'application/json',
            },
            timeout: 60000,
        });
        this.orgId = orgId || '';
        if (this.orgId) {
            this.client.defaults.headers['OpenAI-Organization'] = this.orgId;
        }
    }

    async chat(request: ChatRequest, model: string): Promise<ProviderResponse> {
        const messages = request.messages || [{ role: 'user' as const, content: request.prompt }];
        const response = await this.client.post('/chat/completions', {
            model: model,
            messages: messages,
            max_tokens: request.maxTokens || 1024,
            temperature: request.temperature ?? 0.7,
        });
        const data = response.data;
        const choice = data.choices[0];
        return {
            content: choice.message?.content || '',
            usage: {
                promptTokens: data.usage?.prompt_tokens || 0,
                completionTokens: data.usage?.completion_tokens || 0,
                totalTokens: data.usage?.total_tokens || 0,
            },
            model: data.model || model,
        };
    }

    async streamChat(request: ChatRequest, model: string, callbacks: StreamCallbacks): Promise<void> {
        const messages = request.messages || [{ role: 'user' as const, content: request.prompt }];
        try {
            const response = await this.client.post('/chat/completions', {
                model: model,
                messages: messages,
                max_tokens: request.maxTokens || 1024,
                temperature: request.temperature ?? 0.7,
                stream: true,
            }, {
                responseType: 'stream',
                adapter: 'fetch',
            } as AxiosRequestConfig);

            const stream = response.data;
            let buffer = '';

            stream.on('data', (chunk: Buffer) => {
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const jsonStr = line.slice(6).trim();
                    if (jsonStr === '[DONE]') {
                        callbacks.onDone();
                        return;
                    }
                    try {
                        const json = JSON.parse(jsonStr);
                        const delta = json.choices?.[0]?.delta;
                        if (delta?.content) {
                            callbacks.onChunk({ content: delta.content, provider: 'openai', model: model });
                        }
                        const finishReason = json.choices?.[0]?.finish_reason;
                        if (finishReason) {
                            callbacks.onChunk({
                                content: '',
                                finishReason: finishReason,
                                usage: json.usage ? {
                                    promptTokens: json.usage.prompt_tokens || 0,
                                    completionTokens: json.usage.completion_tokens || 0,
                                    totalTokens: json.usage.total_tokens || 0,
                                } : undefined,
                                provider: 'openai',
                                model: model,
                            });
                        }
                    } catch (e) {
                    }
                }
            });

            stream.on('end', () => callbacks.onDone());
            stream.on('error', (e: Error) => callbacks.onError(e));
        } catch (e) {
            callbacks.onError(e instanceof Error ? e : new Error(String(e)));
        }
    }
}

export class GeminiProvider {
    private apiKey: string;
    private baseUrl: string;

    constructor(apiKey: string, baseUrl?: string) {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl || 'https://generativelanguage.googleapis.com/v1';
    }

    async chat(request: ChatRequest, model: string): Promise<ProviderResponse> {
        const response = await axios.post(
            this.baseUrl + '/models/' + model + ':generateContent',
            {
                contents: [{
                    role: 'user',
                    parts: [{ text: request.prompt }],
                }],
                generationConfig: {
                    maxOutputTokens: request.maxTokens || 1024,
                    temperature: request.temperature ?? 0.7,
                },
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': this.apiKey,
                },
                timeout: 60000,
            }
        );
        const data = response.data;
        const candidate = data.candidates?.[0];
        return {
            content: candidate?.content?.parts?.[0]?.text || '',
            usage: {
                promptTokens: data.usageMetadata?.promptTokenCount || 0,
                completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
                totalTokens: data.usageMetadata?.totalTokenCount || 0,
            },
            model: model,
        };
    }

    async streamChat(request: ChatRequest, model: string, callbacks: StreamCallbacks): Promise<void> {
        try {
            const response = await axios.post(
                this.baseUrl + '/models/' + model + ':streamGenerateContent',
                {
                    contents: [{
                        role: 'user',
                        parts: [{ text: request.prompt }],
                    }],
                    generationConfig: {
                        maxOutputTokens: request.maxTokens || 1024,
                        temperature: request.temperature ?? 0.7,
                    },
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': this.apiKey,
                    },
                    responseType: 'stream',
                    timeout: 60000,
                }
            );

            const stream = response.data;
            let buffer = '';

            stream.on('data', (chunk: Buffer) => {
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const json = JSON.parse(line);
                        const candidate = json.candidates?.[0];
                        const text = candidate?.content?.parts?.[0]?.text || '';
                        if (text) {
                            callbacks.onChunk({ content: text, provider: 'gemini', model: model });
                        }
                        if (candidate?.finishReason) {
                            callbacks.onChunk({
                                content: '',
                                finishReason: candidate.finishReason,
                                usage: json.usageMetadata ? {
                                    promptTokens: json.usageMetadata.promptTokenCount || 0,
                                    completionTokens: json.usageMetadata.candidatesTokenCount || 0,
                                    totalTokens: json.usageMetadata.totalTokenCount || 0,
                                } : undefined,
                                provider: 'gemini',
                                model: model,
                            });
                        }
                    } catch (e) {
                    }
                }
            });

            stream.on('end', () => callbacks.onDone());
            stream.on('error', (e: Error) => callbacks.onError(e));
        } catch (e) {
            callbacks.onError(e instanceof Error ? e : new Error(String(e)));
        }
    }
}

export class CohereProvider {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async chat(request: ChatRequest, _model: string): Promise<ProviderResponse> {
        const response = await axios.post(
            'https://api.cohere.ai/v1/generate',
            {
                prompt: request.prompt,
                max_tokens: request.maxTokens || 1024,
                temperature: request.temperature ?? 0.7,
            },
            {
                headers: {
                    'Authorization': 'Bearer ' + this.apiKey,
                    'Content-Type': 'application/json',
                },
                timeout: 60000,
            }
        );
        const data = response.data;
        const meta = data.meta || {};
        return {
            content: data.generations?.[0]?.text || '',
            usage: {
                promptTokens: meta.billed_units?.input_tokens || 0,
                completionTokens: meta.billed_units?.output_tokens || 0,
                totalTokens: (meta.billed_units?.input_tokens || 0) + (meta.billed_units?.output_tokens || 0),
            },
            model: _model,
        };
    }
}

export function createProvider(type: ProviderType, apiKey: string, baseUrl?: string, orgId?: string): OpenAIProvider | GeminiProvider | CohereProvider {
    switch (type) {
        case 'openai':
            return new OpenAIProvider(apiKey, baseUrl, orgId);
        case 'gemini':
            return new GeminiProvider(apiKey, baseUrl);
        case 'cohere':
            return new CohereProvider(apiKey);
        default:
            throw new Error('Unknown provider: ' + type);
    }
}
