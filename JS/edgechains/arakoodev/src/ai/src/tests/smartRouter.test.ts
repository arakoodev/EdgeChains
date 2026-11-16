/**
 * Verification Suite for EdgeChains SmartRouter (Issue #286)
 * Tests:
 * 1. Load balancing across OpenAI, Google PaLM, and Cohere (least tokens used & below rate-limit)
 * 2. Basic reliability retries via axios.interceptors.response.use + cooldown failover
 * 3. Streaming capability (ReadableStream chunks)
 * 4. Token usage accounting (prompt_tokens, completion_tokens, total_tokens)
 * 5. Observability callbacks (Sentry & PostHog)
 */
import assert from "node:assert/strict";
import { SmartRouter } from "../lib/router/SmartRouter.js";
import { MockAI } from "../lib/router/MockAI.js";

async function readStreamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let result = "";
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const parsed = JSON.parse(decoder.decode(value));
        result += parsed[0].choices[0].delta.content;
    }
    return result;
}

async function runTests() {
    console.log("[Test 1/5] Testing Least-Tokens Load Balancing & Rate Limit Selection...");
    const mockAI = new MockAI();
    mockAI.registerEndpoint("https://mock.openai.local/v1/chat/completions", {
        responseContent: "OpenAI response",
        promptTokens: 30,
        completionTokens: 50, // 80 total tokens
    });
    mockAI.registerEndpoint("https://mock.palm.local/v1beta2/models/chat-bison-001:generateMessage", {
        responseContent: "PaLM response",
        promptTokens: 10,
        completionTokens: 15, // 25 total tokens
    });
    mockAI.registerEndpoint("https://mock.cohere.local/v1/chat", {
        responseContent: "Cohere response",
        promptTokens: 12,
        completionTokens: 18, // 30 total tokens
    });

    const sentryEvents: any[] = [];
    const posthogEvents: any[] = [];

    const router = new SmartRouter({
        httpClient: mockAI.createMockAxiosInstance(),
        callbacks: ["sentry", "posthog"],
        sentryConfig: {
            captureException: (err, ctx) => sentryEvents.push({ err: err.message, ctx }),
        },
        posthogConfig: {
            distinctId: "test-suite",
            capture: (payload) => posthogEvents.push(payload),
        },
        deployments: [
            {
                id: "openai-dep",
                provider: "openai",
                model: "gpt-3.5-turbo",
                apiKey: "sk-test-openai",
                endpointUrl: "https://mock.openai.local/v1/chat/completions",
                rpmLimit: 2,
                tpmLimit: 500,
            },
            {
                id: "palm-dep",
                provider: "palm",
                model: "chat-bison-001",
                apiKey: "palm-test-key",
                endpointUrl: "https://mock.palm.local/v1beta2/models/chat-bison-001:generateMessage",
                rpmLimit: 5,
                tpmLimit: 500,
            },
            {
                id: "cohere-dep",
                provider: "cohere",
                model: "command",
                apiKey: "cohere-test-key",
                endpointUrl: "https://mock.cohere.local/v1/chat",
                rpmLimit: 5,
                tpmLimit: 500,
            },
        ],
    });

    // Call 1: All at 0 tokens -> picks openai-dep (80 tokens used)
    const res1 = await router.chat({ prompt: "Hello router 1" });
    assert.equal(res1.deploymentId, "openai-dep");
    assert.equal(res1.content, "OpenAI response");
    assert.equal(res1.usage.total_tokens, 80);

    // Call 2: palm-dep and cohere-dep are at 0 tokens (< 80) -> picks palm-dep (25 tokens used)
    const res2 = await router.chat({ prompt: "Hello router 2" });
    assert.equal(res2.deploymentId, "palm-dep");
    assert.equal(res2.content, "PaLM response");
    assert.equal(res2.usage.total_tokens, 25);

    // Call 3: cohere-dep is at 0 tokens -> picks cohere-dep (30 tokens used)
    const res3 = await router.chat({ prompt: "Hello router 3" });
    assert.equal(res3.deploymentId, "cohere-dep");
    assert.equal(res3.content, "Cohere response");
    assert.equal(res3.usage.total_tokens, 30);

    // Call 4: Tokens are now openai=80, palm=25, cohere=30 -> picks palm-dep (least tokens used = 25)
    const res4 = await router.chat({ prompt: "Hello router 4" });
    assert.equal(res4.deploymentId, "palm-dep");
    const metrics = router.getDeploymentMetrics();
    assert.equal(metrics["palm-dep"].totalTokensUsed, 50);
    console.log("  -> Passed: Least-tokens load balancing verified across OpenAI, PaLM & Cohere.");

    console.log("[Test 2/5] Testing Reliability Interceptor Retries (429 / 5xx recovery)...");
    mockAI.registerEndpoint("https://mock.flaky-openai.local/v1/chat/completions", {
        status: 503,
        failTimes: 2,
        responseContent: "Recovered after 2 retries",
        promptTokens: 5,
        completionTokens: 5,
    });
    const retryRouter = new SmartRouter({
        httpClient: mockAI.createMockAxiosInstance(),
        defaultMaxRetries: 2,
        defaultRetryDelayMs: 10,
        deployments: [
            {
                id: "flaky-openai",
                provider: "openai",
                model: "gpt-4o",
                apiKey: "sk-flaky",
                endpointUrl: "https://mock.flaky-openai.local/v1/chat/completions",
            },
        ],
    });
    const retryRes = await retryRouter.chat({ prompt: "Test retry" });
    assert.equal(retryRes.content, "Recovered after 2 retries");
    assert.equal(mockAI.getCallCount("https://mock.flaky-openai.local/v1/chat/completions"), 3);
    console.log("  -> Passed: Axios response interceptor retried 2 times and succeeded on 3rd attempt.");

    console.log("[Test 3/5] Testing Automatic Deployment Failover & Sentry Error Callback...");
    mockAI.registerEndpoint("https://mock.dead-openai.local/v1/chat/completions", {
        status: 500,
        failTimes: 10,
    });
    const failoverRouter = new SmartRouter({
        httpClient: mockAI.createMockAxiosInstance(),
        defaultMaxRetries: 1,
        defaultRetryDelayMs: 5,
        callbacks: ["sentry", "posthog"],
        sentryConfig: {
            captureException: (err, ctx) => sentryEvents.push({ err: err.message, ctx }),
        },
        posthogConfig: {
            distinctId: "failover-test",
            capture: (payload) => posthogEvents.push(payload),
        },
        deployments: [
            {
                id: "dead-primary",
                provider: "openai",
                model: "gpt-4o",
                apiKey: "sk-dead",
                endpointUrl: "https://mock.dead-openai.local/v1/chat/completions",
            },
            {
                id: "healthy-cohere-backup",
                provider: "cohere",
                model: "command",
                apiKey: "cohere-ok",
                endpointUrl: "https://mock.cohere.local/v1/chat",
            },
        ],
    });
    const failoverRes = await failoverRouter.chat({ prompt: "Trigger failover" });
    assert.equal(failoverRes.deploymentId, "healthy-cohere-backup");
    assert.equal(failoverRes.content, "Cohere response");
    assert.ok(sentryEvents.length >= 1, "Sentry should have captured the primary deployment failure");
    console.log("  -> Passed: Failed primary cooled down, routed to backup Cohere, and logged to Sentry.");

    console.log("[Test 4/5] Testing Streaming Capability...");
    mockAI.registerEndpoint("https://mock.stream.local/v1/chat/completions", {
        responseContent: "Hi! How can I help you today?",
        streamChunks: ["Hi! ", "How ", "can ", "I ", "help ", "you ", "today?"],
        promptTokens: 6,
        completionTokens: 7,
    });
    const streamRouter = new SmartRouter({
        httpClient: mockAI.createMockAxiosInstance(),
        deployments: [
            {
                id: "stream-openai",
                provider: "openai",
                model: "gpt-4o",
                apiKey: "sk-stream",
                endpointUrl: "https://mock.stream.local/v1/chat/completions",
            },
        ],
    });
    const stream = await streamRouter.streamChat({ prompt: "Stream test" });
    const streamedText = await readStreamToString(stream);
    assert.equal(streamedText, "Hi! How can I help you today?");
    console.log("  -> Passed: ReadableStream yielded expected chunks.");

    console.log("[Test 5/5] Verifying PostHog Telemetry & Token Usage Accounting...");
    assert.ok(posthogEvents.length >= 5, "PostHog should have captured all success/failure events");
    const lastSuccess = posthogEvents.find((e) => e.event === "litellm_deployment_success");
    assert.ok(lastSuccess, "PostHog captured success event");
    assert.equal(typeof lastSuccess.properties.total_tokens, "number");
    console.log("  -> Passed: PostHog telemetry and token usage verified.");

    console.log("\nALL 5 SMART ROUTER TEST SUITES PASSED SUCCESSFULLY!");
}

declare const describe: undefined | ((name: string, fn: () => void) => void);
declare const test: undefined | ((name: string, fn: () => Promise<void>) => void);

if (typeof describe === "function" && typeof test === "function") {
    describe("SmartRouter (LiteLLM-inspired routing)", () => {
        test("passes load balancing, retries, failover, streaming, token usage & observability", async () => {
            await runTests();
        });
    });
} else {
    runTests().catch((err) => {
        console.error("Test suite failed:", err);
        process.exit(1);
    });
}
