import { describe, expect, it, beforeAll, afterAll } from 'bun:test';
import { Router, DeploymentConfig } from '../lib/endpoints/Router.js';
import { MockAIServer } from '../lib/mocks/MockAIServer.js';

describe('Smart Router (LiteLLM Architecture for EdgeChains)', () => {
    let mockServer: MockAIServer;
    let baseUrl: string;

    beforeAll(async () => {
        mockServer = new MockAIServer({
            openaiContent: 'Hello from OpenAI!',
            cohereContent: 'Hello from Cohere!',
            googleContent: 'Hello from Google PaLM!',
            promptTokens: 10,
            completionTokens: 20,
        });
        baseUrl = await mockServer.start();
    });

    afterAll(async () => {
        await mockServer.stop();
    });

    it('Feature 1: Load balances between multiple deployments by picking least tokens', async () => {
        const deployments: DeploymentConfig[] = [
            {
                id: 'openai-dep-1',
                modelName: 'gpt-3.5-turbo',
                provider: 'openai',
                apiKey: 'test-key-1',
                baseUrl: `${baseUrl}/v1/chat/completions`,
            },
            {
                id: 'openai-dep-2',
                modelName: 'gpt-3.5-turbo',
                provider: 'openai',
                apiKey: 'test-key-2',
                baseUrl: `${baseUrl}/v1/chat/completions`,
            },
        ];

        const router = new Router(deployments);
        const depStates = router.getDeployments('gpt-3.5-turbo');

        // Pre-seed dep-2 with higher token usage
        depStates[1].totalTokens = 1000;

        // First call should pick dep-1 (0 tokens < 1000 tokens)
        const res1 = await router.completion({
            model: 'gpt-3.5-turbo',
            prompt: 'Say hello',
        });

        expect(res1.deploymentId).toBe('openai-dep-1');
        expect(res1.content).toBe('Hello from OpenAI!');
        expect(depStates[0].totalTokens).toBe(30); // 10 prompt + 20 completion

        // Second call should still pick dep-1 (30 tokens < 1000 tokens)
        const res2 = await router.completion({
            model: 'gpt-3.5-turbo',
            prompt: 'Say hello again',
        });
        expect(res2.deploymentId).toBe('openai-dep-1');
        expect(depStates[0].totalTokens).toBe(60);

        // Advance dep-1 tokens beyond dep-2
        depStates[0].totalTokens = 1500;

        // Now router should pick dep-2 (1000 tokens < 1500 tokens)
        const res3 = await router.completion({
            model: 'gpt-3.5-turbo',
            prompt: 'Switch to dep 2',
        });
        expect(res3.deploymentId).toBe('openai-dep-2');
    });

    it('Feature 1b: Automatic fallback when primary deployment is rate-limited (429)', async () => {
        const deployments: DeploymentConfig[] = [
            {
                id: 'dep-primary',
                modelName: 'fast-model',
                provider: 'openai',
                apiKey: 'key-1',
                baseUrl: `${baseUrl}/v1/chat/completions`,
            },
            {
                id: 'dep-secondary',
                modelName: 'fast-model',
                provider: 'openai',
                apiKey: 'key-2',
                baseUrl: `${baseUrl}/v1/chat/completions`,
            },
        ];

        const router = new Router(deployments);
        const states = router.getDeployments('fast-model');

        // Set primary to cool down as if hit by 429
        states[0].cooldownUntil = Date.now() + 10000;

        // Call should automatically route to secondary deployment
        const res = await router.completion({
            model: 'fast-model',
            prompt: 'Test fallback',
        });

        expect(res.deploymentId).toBe('dep-secondary');
        expect(res.content).toBe('Hello from OpenAI!');
    });

    it('Feature 2: Multi-provider support (OpenAI, Google PaLM, Cohere)', async () => {
        const router = new Router([
            {
                id: 'openai-call',
                modelName: 'gpt-4',
                provider: 'openai',
                apiKey: 'test-openai',
                baseUrl: `${baseUrl}/v1/chat/completions`,
            },
            {
                id: 'cohere-call',
                modelName: 'command-r',
                provider: 'cohere',
                apiKey: 'test-cohere',
                baseUrl: `${baseUrl}/v1/chat`,
            },
            {
                id: 'palm-call',
                modelName: 'palm-2',
                provider: 'google',
                apiKey: 'test-palm',
                baseUrl: `${baseUrl}/v1beta/models/palm-2:generateContent`,
            },
        ]);

        // 1. OpenAI
        const rOpenAI = await router.completion({ model: 'gpt-4', prompt: 'Hi' });
        expect(rOpenAI.provider).toBe('openai');
        expect(rOpenAI.content).toBe('Hello from OpenAI!');
        expect(rOpenAI.usage.totalTokens).toBe(30);

        // 2. Cohere
        const rCohere = await router.completion({ model: 'command-r', prompt: 'Hi' });
        expect(rCohere.provider).toBe('cohere');
        expect(rCohere.content).toBe('Hello from Cohere!');
        expect(rCohere.usage.totalTokens).toBe(30);

        // 3. Google PaLM
        const rPalm = await router.completion({ model: 'palm-2', prompt: 'Hi' });
        expect(rPalm.provider).toBe('google');
        expect(rPalm.content).toBe('Hello from Google PaLM!');
        expect(rPalm.usage.totalTokens).toBe(30);
    });

    it('Feature 3: Token usage tracking across multiple calls', async () => {
        const router = new Router([
            {
                id: 'tracked-dep',
                modelName: 'tracked-model',
                provider: 'openai',
                apiKey: 'test-key',
                baseUrl: `${baseUrl}/v1/chat/completions`,
            },
        ]);

        const depState = router.getDeployments('tracked-model')[0];
        expect(depState.totalTokens).toBe(0);

        await router.completion({ model: 'tracked-model', prompt: 'Call 1' });
        expect(depState.totalTokens).toBe(30);

        await router.completion({ model: 'tracked-model', prompt: 'Call 2' });
        expect(depState.totalTokens).toBe(60);
    });

    it('Feature 4: Observability callbacks for Sentry and PostHog', async () => {
        const events: any[] = [];
        const router = new Router(
            [
                {
                    id: 'obs-dep',
                    modelName: 'obs-model',
                    provider: 'openai',
                    apiKey: 'test-key',
                    baseUrl: `${baseUrl}/v1/chat/completions`,
                },
            ],
            {},
            {
                onSuccess: (evt) => {
                    events.push({ type: 'success', ...evt });
                },
                onFailure: (evt) => {
                    events.push({ type: 'failure', ...evt });
                },
            }
        );

        await router.completion({ model: 'obs-model', prompt: 'Observe me' });

        expect(events.length).toBe(1);
        expect(events[0].type).toBe('success');
        expect(events[0].model).toBe('obs-model');
        expect(events[0].provider).toBe('openai');
        expect(events[0].usage.totalTokens).toBe(30);
        expect(events[0].latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('Feature 6: Reliability - automatically retries transient server errors (500)', async () => {
        mockServer.setError(500, 1); // 1 error, then recovers
        const router = new Router([
            {
                id: 'retry-dep',
                modelName: 'retry-model',
                provider: 'openai',
                apiKey: 'test-key',
                baseUrl: `${baseUrl}/v1/chat/completions`,
                maxRetries: 2,
            },
        ]);

        const res = await router.completion({
            model: 'retry-model',
            prompt: 'Test retry',
        });

        expect(res.content).toBe('Hello from OpenAI!');
        expect(res.deploymentId).toBe('retry-dep');
    });

    it('Feature 5: Jsonnet / JSON configuration instantiation', () => {
        const config = {
            deployments: [
                {
                    id: 'jsonnet-dep',
                    modelName: 'gpt-3.5-turbo',
                    provider: 'openai' as const,
                    apiKey: 'key-from-jsonnet',
                },
            ],
        };

        const router = Router.fromJsonnet(config);
        const deps = router.getDeployments('gpt-3.5-turbo');
        expect(deps.length).toBe(1);
        expect(deps[0].config.apiKey).toBe('key-from-jsonnet');
    });
});
