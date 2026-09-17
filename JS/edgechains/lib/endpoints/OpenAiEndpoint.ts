// JS/edgechains/lib/src/lib/endpoints/OpenAiEndpoint.ts
// This file is now a simple facade that uses the new SmartRouter.

import { SmartRouter, RouterConfig } from '../router/router'; 
import { CompletionRequest, CompletionResponse } from '../router/types';

// Example config - in a real app, this would be loaded from a Jsonnet file
const routerConfig: RouterConfig = {
    cooldownPeriod: 30000, // 30 seconds
    deployments: [
        {
            id: 'openai-deployment-1',
            model: 'gpt-4',
            provider: 'openai',
            apiKey: process.env.OPENAI_API_KEY || '',
            rpm: 1000,
            tpm: 100000,
            // Internal state is managed by the router
            tokensUsed: 0, requestsMade: 0, windowStart: 0, isUnhealthy: false, healthyAgainAt: 0
        },
        // Add other deployments for Cohere, PaLM etc. here
    ]
};

const router = new SmartRouter(routerConfig);

export class OpenAiEndpoint {
    public async chat(request: CompletionRequest): Promise<CompletionResponse> {
        return router.completion(request);
    }
}
