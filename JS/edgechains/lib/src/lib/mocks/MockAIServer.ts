import http from 'http';

export interface MockAIConfig {
    openaiContent?: string;
    cohereContent?: string;
    googleContent?: string;
    rateLimitCount?: number;
    errorStatus?: number;
    errorCount?: number;
    delayMs?: number;
    promptTokens?: number;
    completionTokens?: number;
}

export class MockAIServer {
    private server: http.Server | null = null;
    private port: number = 0;
    public requestsReceived: Array<{ url: string; method: string; body: any; headers: any }> = [];
    private config: MockAIConfig;
    private rateLimitsRemaining: number = 0;
    private errorsRemaining: number = 0;

    constructor(config: MockAIConfig = {}) {
        this.config = {
            openaiContent: 'Mocked OpenAI response',
            cohereContent: 'Mocked Cohere response',
            googleContent: 'Mocked Google PaLM response',
            promptTokens: 15,
            completionTokens: 25,
            ...config,
        };
        this.rateLimitsRemaining = config.rateLimitCount || 0;
        this.errorsRemaining = config.errorCount || 0;
    }

    public async start(): Promise<string> {
        return new Promise((resolve) => {
            this.server = http.createServer((req, res) => {
                let rawBody = '';
                req.on('data', (chunk) => {
                    rawBody += chunk.toString();
                });

                req.on('end', () => {
                    let parsedBody: any = {};
                    try {
                        parsedBody = JSON.parse(rawBody);
                    } catch {}

                    this.requestsReceived.push({
                        url: req.url || '',
                        method: req.method || 'GET',
                        body: parsedBody,
                        headers: req.headers,
                    });

                    // Simulated Delay
                    const delay = this.config.delayMs || 0;
                    setTimeout(() => {
                        this.handleResponse(req, res, parsedBody);
                    }, delay);
                });
            });

            this.server.listen(0, '127.0.0.1', () => {
                const addr = this.server!.address() as any;
                this.port = addr.port;
                resolve(`http://127.0.0.1:${this.port}`);
            });
        });
    }

    public getBaseUrl(): string {
        return `http://127.0.0.1:${this.port}`;
    }

    public setRateLimit(count: number): void {
        this.rateLimitsRemaining = count;
    }

    public setError(status: number, count: number = 1): void {
        this.config.errorStatus = status;
        this.errorsRemaining = count;
    }

    private handleResponse(req: http.IncomingMessage, res: http.ServerResponse, body: any): void {
        // Handle Simulated Rate Limit (429)
        if (this.rateLimitsRemaining > 0) {
            this.rateLimitsRemaining--;
            res.writeHead(429, {
                'Content-Type': 'application/json',
                'Retry-After': '1',
            });
            res.end(JSON.stringify({ error: { message: 'Rate limit exceeded' } }));
            return;
        }

        // Handle Simulated Server Error (5xx)
        if (this.errorsRemaining > 0 && this.config.errorStatus) {
            this.errorsRemaining--;
            res.writeHead(this.config.errorStatus, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { message: 'Simulated backend failure' } }));
            return;
        }

        const url = req.url || '';

        // OpenAI Mock
        if (url.includes('/chat/completions') || url.includes('/v1/chat/completions')) {
            const promptT = this.config.promptTokens || 12;
            const compT = this.config.completionTokens || 18;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
                JSON.stringify({
                    id: 'mock-openai-' + Date.now(),
                    object: 'chat.completion',
                    choices: [
                        {
                            message: {
                                role: 'assistant',
                                content: this.config.openaiContent,
                            },
                            finish_reason: 'stop',
                        },
                    ],
                    usage: {
                        prompt_tokens: promptT,
                        completion_tokens: compT,
                        total_tokens: promptT + compT,
                    },
                })
            );
            return;
        }

        // Cohere Mock
        if (url.includes('/v1/chat') || url.includes('/cohere')) {
            const promptT = this.config.promptTokens || 10;
            const compT = this.config.completionTokens || 20;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
                JSON.stringify({
                    text: this.config.cohereContent,
                    meta: {
                        tokens: {
                            input_tokens: promptT,
                            output_tokens: compT,
                        },
                    },
                })
            );
            return;
        }

        // Google PaLM Mock
        if (url.includes('generateContent') || url.includes('google') || url.includes('palm')) {
            const promptT = this.config.promptTokens || 8;
            const compT = this.config.completionTokens || 16;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(
                JSON.stringify({
                    candidates: [
                        {
                            content: {
                                parts: [{ text: this.config.googleContent }],
                            },
                        },
                    ],
                    usageMetadata: {
                        promptTokenCount: promptT,
                        candidatesTokenCount: compT,
                        totalTokenCount: promptT + compT,
                    },
                })
            );
            return;
        }

        // Default Fallback
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ content: 'Default mock response' }));
    }

    public async stop(): Promise<void> {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => resolve());
            } else {
                resolve();
            }
        });
    }
}
