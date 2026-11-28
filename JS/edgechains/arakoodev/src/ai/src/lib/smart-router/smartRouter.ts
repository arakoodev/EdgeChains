import axios, { AxiosError } from "axios";
import { role } from "../../types/index.js";

export type SmartRouterProvider = "openai" | "palm" | "cohere";

export interface SmartRouterMessage {
  role: role;
  content: string;
  name?: string;
}

export interface SmartRouterDeployment {
  id: string;
  provider: SmartRouterProvider;
  apiKey: string;
  model: string;
  orgId?: string;
  url?: string;
  tokenLimit?: number;
  cooldownMs?: number;
}

export interface SmartRouterChatOptions {
  prompt?: string;
  messages?: SmartRouterMessage[];
  max_tokens?: number;
  temperature?: number;
  retryCount?: number;
}

export interface SmartRouterChatResponse {
  content: string;
  provider: SmartRouterProvider;
  deploymentId: string;
  raw: unknown;
  usage: {
    totalTokens: number;
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface SmartRouterCallbackPayload {
  deployment: SmartRouterDeployment;
  options: SmartRouterChatOptions;
  response?: SmartRouterChatResponse;
  error?: unknown;
  attempt: number;
}

export interface SmartRouterCallbacks {
  onPreCall?: (payload: SmartRouterCallbackPayload) => void | Promise<void>;
  onSuccess?: (payload: SmartRouterCallbackPayload) => void | Promise<void>;
  onError?: (payload: SmartRouterCallbackPayload) => void | Promise<void>;
}

type SmartRouterTransport = (request: {
  deployment: SmartRouterDeployment;
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}) => Promise<unknown>;

interface DeploymentState {
  tokensUsed: number;
  requestCount: number;
  coolingDownUntil: number;
  lastError?: unknown;
}

export interface SmartRouterOptions {
  deployments: SmartRouterDeployment[];
  callbacks?: SmartRouterCallbacks;
  now?: () => number;
  transport?: SmartRouterTransport;
}

const DEFAULT_COOLDOWN_MS = 30_000;

export class SmartEndpointRouter {
  private deployments: SmartRouterDeployment[];
  private callbacks: SmartRouterCallbacks;
  private state = new Map<string, DeploymentState>();
  private now: () => number;
  private transport: SmartRouterTransport;

  constructor(options: SmartRouterOptions) {
    if (!options.deployments.length) {
      throw new Error("SmartEndpointRouter requires at least one deployment.");
    }

    this.deployments = options.deployments;
    this.callbacks = options.callbacks || {};
    this.now = options.now || Date.now;
    this.transport = options.transport || this.defaultTransport;

    for (const deployment of this.deployments) {
      this.state.set(deployment.id, {
        tokensUsed: 0,
        requestCount: 0,
        coolingDownUntil: 0,
      });
    }
  }

  getDeploymentState(deploymentId: string): DeploymentState | undefined {
    return this.state.get(deploymentId);
  }

  async chat(
    options: SmartRouterChatOptions,
  ): Promise<SmartRouterChatResponse> {
    const retryCount = options.retryCount ?? this.deployments.length;
    let lastError: unknown;

    for (let attempt = 1; attempt <= retryCount; attempt += 1) {
      const deployment = this.pickDeployment();
      if (!deployment) {
        throw new Error("No healthy deployment is available for routing.");
      }

      try {
        await this.callbacks.onPreCall?.({ deployment, options, attempt });

        const request = this.buildRequest(deployment, options);
        const raw = await this.transport({
          deployment,
          ...request,
        });
        const response = this.normalizeResponse(deployment, raw);

        this.recordSuccess(deployment.id, response.usage.totalTokens);
        await this.callbacks.onSuccess?.({
          deployment,
          options,
          response,
          attempt,
        });
        return response;
      } catch (error) {
        lastError = error;
        this.recordError(deployment, error);
        await this.callbacks.onError?.({ deployment, options, error, attempt });
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("All routed deployments failed.");
  }

  private pickDeployment(): SmartRouterDeployment | undefined {
    const now = this.now();

    return this.deployments
      .filter((deployment) => {
        const state = this.state.get(deployment.id);
        if (!state) return false;
        if (state.coolingDownUntil > now) return false;
        if (deployment.tokenLimit && state.tokensUsed >= deployment.tokenLimit)
          return false;
        return true;
      })
      .sort((a, b) => {
        const aState = this.state.get(a.id);
        const bState = this.state.get(b.id);
        return (aState?.tokensUsed || 0) - (bState?.tokensUsed || 0);
      })[0];
  }

  private buildRequest(
    deployment: SmartRouterDeployment,
    options: SmartRouterChatOptions,
  ): {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  } {
    const messages = options.prompt
      ? [{ role: "user" as role, content: options.prompt }]
      : options.messages || [];

    if (deployment.provider === "openai") {
      return {
        url: deployment.url || "https://api.openai.com/v1/chat/completions",
        headers: {
          Authorization: `Bearer ${deployment.apiKey}`,
          "Content-Type": "application/json",
          ...(deployment.orgId
            ? { "OpenAI-Organization": deployment.orgId }
            : {}),
        },
        body: {
          model: deployment.model,
          messages,
          max_tokens: options.max_tokens || 256,
          temperature: options.temperature || 0.7,
        },
      };
    }

    if (deployment.provider === "palm") {
      return {
        url:
          deployment.url ||
          `https://generativelanguage.googleapis.com/v1beta/models/${deployment.model}:generateContent?key=${deployment.apiKey}`,
        headers: {
          "Content-Type": "application/json",
        },
        body: {
          contents: messages.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
          })),
          generationConfig: {
            maxOutputTokens: options.max_tokens || 256,
            temperature: options.temperature || 0.7,
          },
        },
      };
    }

    return {
      url: deployment.url || "https://api.cohere.ai/v1/chat",
      headers: {
        Authorization: `Bearer ${deployment.apiKey}`,
        "Content-Type": "application/json",
      },
      body: {
        model: deployment.model,
        message: messages.map((message) => message.content).join("\n"),
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 256,
      },
    };
  }

  private normalizeResponse(
    deployment: SmartRouterDeployment,
    raw: any,
  ): SmartRouterChatResponse {
    if (deployment.provider === "openai") {
      return {
        content: raw.choices?.[0]?.message?.content || "",
        provider: deployment.provider,
        deploymentId: deployment.id,
        raw,
        usage: {
          totalTokens: raw.usage?.total_tokens || 0,
          promptTokens: raw.usage?.prompt_tokens,
          completionTokens: raw.usage?.completion_tokens,
        },
      };
    }

    if (deployment.provider === "palm") {
      return {
        content: raw.candidates?.[0]?.content?.parts?.[0]?.text || "",
        provider: deployment.provider,
        deploymentId: deployment.id,
        raw,
        usage: {
          totalTokens: raw.usageMetadata?.totalTokenCount || 0,
          promptTokens: raw.usageMetadata?.promptTokenCount,
          completionTokens: raw.usageMetadata?.candidatesTokenCount,
        },
      };
    }

    return {
      content: raw.text || raw.message?.content?.[0]?.text || "",
      provider: deployment.provider,
      deploymentId: deployment.id,
      raw,
      usage: {
        totalTokens:
          raw.meta?.tokens?.input_tokens + raw.meta?.tokens?.output_tokens || 0,
        promptTokens: raw.meta?.tokens?.input_tokens,
        completionTokens: raw.meta?.tokens?.output_tokens,
      },
    };
  }

  private recordSuccess(deploymentId: string, totalTokens: number): void {
    const state = this.state.get(deploymentId);
    if (!state) return;

    state.tokensUsed += totalTokens;
    state.requestCount += 1;
    state.lastError = undefined;
  }

  private recordError(deployment: SmartRouterDeployment, error: unknown): void {
    const state = this.state.get(deployment.id);
    if (!state) return;

    state.lastError = error;
    if (this.shouldCooldown(error)) {
      state.coolingDownUntil =
        this.now() + (deployment.cooldownMs || DEFAULT_COOLDOWN_MS);
    }
  }

  private shouldCooldown(error: unknown): boolean {
    const status = (error as AxiosError)?.response?.status;
    return status === 429 || (!!status && status >= 500);
  }

  private defaultTransport: SmartRouterTransport = async ({
    url,
    headers,
    body,
  }) => {
    const response = await axios.post(url, body, { headers });
    return response.data;
  };
}
