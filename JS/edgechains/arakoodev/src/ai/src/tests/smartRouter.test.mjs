import test from 'node:test';
import assert from 'node:assert/strict';

class SmartRouter {
    constructor(configs, options = {}) {
        this.maxRetries = options.maxRetries ?? 3;
        this.cooldownMs = options.cooldownMs ?? 30000;
        this.deployments = new Map(
            configs.map((c) => [
                c.id,
                { config: c, requestsInWindow: 0, tokensUsedTotal: 0, failures: 0, cooldownUntilMs: 0 },
            ])
        );
    }

    selectBestDeployment(nowMs = Date.now(), excluded = new Set()) {
        const candidates = Array.from(this.deployments.values()).filter(
            (d) =>
                !excluded.has(d.config.id) &&
                d.cooldownUntilMs <= nowMs &&
                d.requestsInWindow < d.config.rateLimitRpm &&
                d.tokensUsedTotal < d.config.rateLimitTpm
        );
        if (!candidates.length) throw new Error('No healthy deployments available');
        candidates.sort((a, b) => a.tokensUsedTotal - b.tokensUsedTotal);
        return candidates[0];
    }

    async complete(prompt, nowMs = Date.now()) {
        const excluded = new Set();
        let attempts = 0;
        while (attempts < this.maxRetries) {
            attempts += 1;
            const target = this.selectBestDeployment(nowMs, excluded);
            try {
                target.requestsInWindow += 1;
                const res = await target.config.handler(prompt, target.config.model);
                target.tokensUsedTotal += res.tokensUsed;
                return {
                    deploymentId: target.config.id,
                    provider: target.config.provider,
                    text: res.text,
                    tokensUsed: res.tokensUsed,
                    attempts,
                };
            } catch (e) {
                target.failures += 1;
                target.cooldownUntilMs = nowMs + this.cooldownMs;
                excluded.add(target.config.id);
            }
        }
        throw new Error('All deployments failed');
    }
}

test('SmartRouter load-balances by picking deployment below rate-limit with least tokens used', async () => {
    const router = new SmartRouter([
        {
            id: 'openai-1',
            provider: 'openai',
            model: 'gpt-3.5-turbo',
            rateLimitRpm: 10,
            rateLimitTpm: 10000,
            handler: async () => ({ text: 'from-openai', tokensUsed: 120 }),
        },
        {
            id: 'palm2-1',
            provider: 'palm2',
            model: 'text-bison-001',
            rateLimitRpm: 10,
            rateLimitTpm: 10000,
            handler: async () => ({ text: 'from-palm2', tokensUsed: 80 }),
        },
        {
            id: 'cohere-1',
            provider: 'cohere',
            model: 'command',
            rateLimitRpm: 10,
            rateLimitTpm: 10000,
            handler: async () => ({ text: 'from-cohere', tokensUsed: 50 }),
        },
    ]);

    const r1 = await router.complete('First query');
    assert.equal(r1.deploymentId, 'openai-1');

    // Second query should pick palm2-1 since openai-1 now has 120 tokens used
    const r2 = await router.complete('Second query');
    assert.equal(r2.deploymentId, 'palm2-1');

    // Third query should pick cohere-1 (0 tokens used)
    const r3 = await router.complete('Third query');
    assert.equal(r3.deploymentId, 'cohere-1');
});

test('SmartRouter automatically fails over to secondary provider when primary throws 429/500', async () => {
    const router = new SmartRouter([
        {
            id: 'openai-broken',
            provider: 'openai',
            model: 'gpt-4',
            rateLimitRpm: 10,
            rateLimitTpm: 10000,
            handler: async () => {
                throw new Error('HTTP 429 Rate Limit Exceeded');
            },
        },
        {
            id: 'palm2-backup',
            provider: 'palm2',
            model: 'text-bison-001',
            rateLimitRpm: 10,
            rateLimitTpm: 10000,
            handler: async () => ({ text: 'Recovered via PaLM 2', tokensUsed: 64 }),
        },
    ]);

    const res = await router.complete('Hello router');
    assert.equal(res.deploymentId, 'palm2-backup');
    assert.equal(res.provider, 'palm2');
    assert.equal(res.attempts, 2);
});
