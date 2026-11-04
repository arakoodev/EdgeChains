import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { LogEvent, Router } from "../index.js";
import { createMockLLMServer, json, MockLLMServer } from "./helpers/mockLLMServer.js";

const MESSAGES = [{ role: "user", content: "hello" }];

function deployment(baseUrl: string, apiKey: string) {
    return {
        model_name: "gpt-3.5-turbo",
        litellm_params: {
            model: "openai/gpt-3.5-turbo",
            api_key: apiKey,
            api_base: `${baseUrl}/v1`,
        },
    };
}

async function waitFor(pred: () => boolean, ms = 2000): Promise<void> {
    const deadline = Date.now() + ms;
    while (!pred()) {
        if (Date.now() > deadline) throw new Error("timed out waiting for callback delivery");
        await new Promise((r) => setTimeout(r, 10));
    }
}

describe("Router logging callbacks", () => {
    let mock: MockLLMServer;
    beforeAll(async () => {
        mock = await createMockLLMServer();
    });
    afterAll(async () => {
        await mock.close();
    });

    it("invokes custom success and failure callbacks", async () => {
        const success = vi.fn();
        const failure = vi.fn();
        const router = new Router({
            model_list: [deployment(mock.baseUrl, "cb")],
            success_callback: [success],
            failure_callback: [failure],
        });
        await router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES });

        expect(success).toHaveBeenCalledOnce();
        const event: LogEvent = success.mock.calls[0][0];
        expect(event.type).toBe("success");
        expect(event.model).toBe("gpt-3.5-turbo");
        expect(event.usage?.total_tokens).toBe(12);
        expect(failure).not.toHaveBeenCalled();
    });

    it("ships success events to posthog", async () => {
        const marker = mock.requests.length;
        const router = new Router({
            model_list: [deployment(mock.baseUrl, "ph")],
            posthog_api_key: "test-posthog-api-key",
            posthog_host: mock.baseUrl,
            success_callback: ["posthog"],
        });
        await router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES });

        await waitFor(() => mock.requests.slice(marker).some((r) => r.url === "/capture/"));
        const capture = mock.requests.slice(marker).find((r) => r.url === "/capture/")!;
        expect(capture.body.api_key).toBe("test-posthog-api-key");
        expect(capture.body.event).toBe("llm.success");
        expect(capture.body.properties.model).toBe("gpt-3.5-turbo");
        expect(capture.body.properties.usage.total_tokens).toBe(12);
    });

    it("ships failure events to sentry", async () => {
        const marker = mock.requests.length;
        const router = new Router({
            model_list: [deployment(mock.baseUrl, "bad")],
            sentry_dsn: `${mock.baseUrl.replace("http://", "http://example-public-key@")}/42`,
            failure_callback: ["sentry"],
            num_retries: 0,
        });
        mock.route("POST", "/v1/chat/completions", (req, res) => json(res, 500, { error: "boom" }));
        try {
            await expect(
                router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES })
            ).rejects.toThrow();

            await waitFor(() =>
                mock.requests.slice(marker).some((r) => /\/api\/42\/envelope\//.test(r.url))
            );
            const envelope = mock.requests
                .slice(marker)
                .find((r) => /\/api\/42\/envelope\//.test(r.url))!;
            expect(envelope.headers["x-sentry-auth"]).toContain("sentry_key=example-public-key");
            expect(String(envelope.body)).toContain("llm.failure");
        } finally {
            mock.clearRoutes();
        }
    });

    it("does not let a throwing callback break the completion", async () => {
        const router = new Router({
            model_list: [deployment(mock.baseUrl, "cb2")],
            success_callback: [
                () => {
                    throw new Error("callback exploded");
                },
            ],
        });
        const res = await router.completion({ model: "gpt-3.5-turbo", messages: MESSAGES });
        expect(res.choices[0].message.content).toBe("openai says hi");
    });
});
