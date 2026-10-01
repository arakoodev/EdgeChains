import { PostHog } from "posthog-node";
import { LogPayload } from "../types.js";

export class PosthogLogger {
  private client?: PostHog;
  private enabled: boolean = false;
  private apiKey?: string;

  constructor(
    apiKey?: string,
    apiHost: string = "https://app.posthog.com",
    enabled: boolean = true,
  ) {
    if (apiKey) {
      this.apiKey = apiKey;
      this.enabled = enabled;
      this.client = new PostHog(apiKey, {
        host: apiHost,
      });
    }
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  setApiKey(apiKey: string, apiHost?: string): void {
    this.apiKey = apiKey;
    this.client = new PostHog(apiKey, {
      host: apiHost,
    });
  }

  async logSuccess(payload: LogPayload): Promise<void> {
    if (!this.enabled || !this.client) return;

    this.client.capture({
      event: "llm_call_success",
      distinctId: "edgechains-user",
      properties: {
        model: payload.model,
        provider: payload.provider,
        deployment: payload.deployment,
        latency_ms: payload.latency,
        prompt_tokens: payload.tokens?.promptTokens,
        completion_tokens: payload.tokens?.completionTokens,
        total_tokens: payload.tokens?.totalTokens,
        cost_usd: payload.tokens?.costUSD,
        created_at: new Date(payload.startTime).toISOString(),
        duration_ms: payload.endTime - payload.startTime,
      },
    });
  }

  async logFailure(payload: LogPayload, errorMessage: string): Promise<void> {
    if (!this.enabled || !this.client) return;

    this.client.capture({
      event: "llm_call_failure",
      distinctId: "edgechains-user",
      properties: {
        model: payload.model,
        provider: payload.provider,
        deployment: payload.deployment,
        latency_ms: payload.latency,
        error: errorMessage,
        created_at: new Date(payload.startTime).toISOString(),
        duration_ms: payload.endTime - payload.startTime,
      },
    });
  }

  async logPreCall(payload: Partial<LogPayload>): Promise<void> {
    if (!this.enabled || !this.client) return;

    this.client.capture({
      event: "llm_pre_call",
      distinctId: "edgechains-user",
      properties: {
        model: payload.model,
        provider: payload.provider,
        deployment: payload.deployment,
      },
    });
  }

  async logPostCall(payload: LogPayload): Promise<void> {
    if (!this.enabled || !this.client) return;

    this.client.capture({
      event: "llm_post_call",
      distinctId: "edgechains-user",
      properties: {
        model: payload.model,
        provider: payload.provider,
        deployment: payload.deployment,
        latency_ms: payload.latency,
        status: payload.status,
      },
    });
  }

  async flush(): Promise<void> {
    if (this.client) {
      await this.client.flush();
    }
  }

  shutdown(): void {
    if (this.client) {
      this.client.shutdown();
    }
  }
}
