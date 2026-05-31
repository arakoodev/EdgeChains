import { describe, expect, it, vi } from "vitest";
import {
  SmartEndpointRouter,
  SmartRouterDeployment,
} from "../lib/smart-router/smartRouter.js";

const deployments: SmartRouterDeployment[] = [
  {
    id: "openai-primary",
    provider: "openai",
    apiKey: "openai-key",
    model: "gpt-4o",
    tokenLimit: 100,
  },
  {
    id: "cohere-backup",
    provider: "cohere",
    apiKey: "cohere-key",
    model: "command-r",
    tokenLimit: 100,
  },
];

describe("SmartEndpointRouter", () => {
  it("routes to the healthy deployment with the least token usage", async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce({
        choices: [{ message: { content: "first" } }],
        usage: { total_tokens: 90 },
      })
      .mockResolvedValueOnce({
        text: "second",
        meta: { tokens: { input_tokens: 2, output_tokens: 3 } },
      });

    const router = new SmartEndpointRouter({ deployments, transport });

    const first = await router.chat({ prompt: "hello" });
    const second = await router.chat({ prompt: "hello again" });

    expect(first.deploymentId).toBe("openai-primary");
    expect(second.deploymentId).toBe("cohere-backup");
    expect(transport).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        deployment: expect.objectContaining({ id: "cohere-backup" }),
      }),
    );
  });

  it("puts rate-limited deployments on cooldown and retries another deployment", async () => {
    let now = 1_000;
    const transport = vi
      .fn()
      .mockRejectedValueOnce({ response: { status: 429 } })
      .mockResolvedValueOnce({
        text: "backup",
        meta: { tokens: { input_tokens: 1, output_tokens: 1 } },
      })
      .mockResolvedValue({
        text: "backup again",
        meta: { tokens: { input_tokens: 1, output_tokens: 1 } },
      });

    const router = new SmartEndpointRouter({
      deployments: [{ ...deployments[0], cooldownMs: 5_000 }, deployments[1]],
      now: () => now,
      transport,
    });

    const response = await router.chat({ prompt: "retry me", retryCount: 2 });

    expect(response.deploymentId).toBe("cohere-backup");
    expect(router.getDeploymentState("openai-primary")?.coolingDownUntil).toBe(
      6_000,
    );

    now = 2_000;
    await router.chat({ prompt: "still cooling" });

    expect(transport).toHaveBeenLastCalledWith(
      expect.objectContaining({
        deployment: expect.objectContaining({ id: "cohere-backup" }),
      }),
    );
  });

  it("emits observability callbacks for successful calls", async () => {
    const onPreCall = vi.fn();
    const onSuccess = vi.fn();
    const transport = vi.fn().mockResolvedValue({
      choices: [{ message: { content: "observed" } }],
      usage: { total_tokens: 4 },
    });

    const router = new SmartEndpointRouter({
      deployments: [deployments[0]],
      callbacks: { onPreCall, onSuccess },
      transport,
    });

    const response = await router.chat({ prompt: "track this" });

    expect(response.content).toBe("observed");
    expect(onPreCall).toHaveBeenCalledWith(
      expect.objectContaining({
        deployment: expect.objectContaining({ id: "openai-primary" }),
        attempt: 1,
      }),
    );
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        response: expect.objectContaining({ content: "observed" }),
      }),
    );
  });
});
