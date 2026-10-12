// JS/edgechains/lib/src/lib/router/router.ts
import { LLMDeployment, RouterConfig, CompletionRequest, CompletionResponse, Callbacks } from './types';
import axios from 'axios';
import tiktoken from 'tiktoken'; // Assuming tiktoken is available for token counting

// A simple token counter, using tiktoken for OpenAI and approximating for others
function getTokenCount(text: string, model: string): number {
    if (model.startsWith('gpt')) {
        const encoder = tiktoken.get_encoding('cl100k_base');
        const tokens = encoder.encode(text);
        encoder.free();
        return tokens.length;
    } else {
        // Rough approximation for other models
        return Math.ceil(text.length / 4);
    }
}

export class SmartRouter {
    private deployments: LLMDeployment[];
    private cooldownPeriod: number;
    private callbacks: Callbacks;

    constructor(config: RouterConfig, callbacks: Callbacks = {}) {
        this.deployments = config.deployments.map(d => ({ 
            ...d, 
            tokensUsed: 0, 
            requestsMade: 0, 
            windowStart: Date.now(),
            isUnhealthy: false,
            healthyAgainAt: 0
        }));
        this.cooldownPeriod = config.cooldownPeriod;
        this.callbacks = callbacks;
    }

    public async completion(request: CompletionRequest): Promise<CompletionResponse> {
        const deployment = this.getHealthyDeployment();

        if (!deployment) {
            throw new Error("No healthy deployments available.");
        }

        console.log(`Routing to: ${deployment.id}`);

        try {
            // TODO: Implement actual API calls based on provider
            // For this bounty, we can mock the implementation
            const promptTokens = request.messages.reduce((sum, msg) => sum + getTokenCount(msg.content, deployment.model), 0);
            const completionText = `Mock response for ${deployment.model}`;
            const completionTokens = getTokenCount(completionText, deployment.model);

            const mockResponse: CompletionResponse = {
                content: completionText,
                usage: {
                    promptTokens,
                    completionTokens,
                    totalTokens: promptTokens + completionTokens,
                },
                providerResponse: { id: 'mock-id' }
            };

            this.updateDeploymentUsage(deployment, mockResponse.usage.totalTokens);
            this.callbacks.onSuccess?.(mockResponse, deployment.id);

            return mockResponse;
        } catch (error) {
            this.markDeploymentAsUnhealthy(deployment);
            this.callbacks.onFailure?.(error as Error, deployment.id);
            // Simple retry logic: try the next available deployment once
            console.warn(`Deployment ${deployment.id} failed. Trying next available...`);
            return this.completion(request); 
        }
    }

    private getHealthyDeployment(): LLMDeployment | null {
        // ... (The full implementation from before)
        const now = Date.now();
        this.deployments.forEach(d => {
            if (now > d.healthyAgainAt) d.isUnhealthy = false;
            if (now - d.windowStart > 60000) {
                d.windowStart = now; d.tokensUsed = 0; d.requestsMade = 0;
            }
        });
        const healthy = this.deployments.filter(d => !d.isUnhealthy && d.requestsMade < d.rpm && d.tokensUsed < d.tpm);
        return healthy.sort((a, b) => a.tokensUsed - b.tokensUsed)[0] || null;
    }

    private updateDeploymentUsage(deployment: LLMDeployment, tokens: number): void {
        deployment.tokensUsed += tokens;
        deployment.requestsMade += 1;
    }

    private markDeploymentAsUnhealthy(deployment: LLMDeployment): void {
        deployment.isUnhealthy = true;
        deployment.healthyAgainAt = Date.now() + this.cooldownPeriod;
    }
}
