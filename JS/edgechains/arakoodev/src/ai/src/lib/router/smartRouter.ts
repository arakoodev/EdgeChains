import axios from "axios";

type Provider = "openai" | "google" | "cohere";

export interface SmartRouterUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface SmartRouterRequest {
  prompt?: string;
  messages?: Array<{ role: string; content: string }>;
  model?: string;
  stream?: boolean;
  [key: string]: unknown;
}

export interface SmartRouterResponse {
  content: unknown;
  deploymentId: string;
  provider: Provider;
  usage?: SmartRouterUsage;
  raw?: unknown;
}

export type SmartRouterHandler = (
  request: SmartRouterRequest,
  deployment: SmartRouterDeployment,
) => Promise<unknown>;

export interface SmartRouterDeployment {
  id: string;
  provider: Provider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  tokenLimit?: number;
  tokenUsage?: number;
  timeoutMs?: number;
  handler?: SmartRouterHandler;
}

export interface SmartRouterLogEvent {
  event:
    | "deployment_attempt"
    | "deployment_success"
    | "deployment_rate_limited"
    | "deployment_failed";
  deploymentId: string;
  provider: Provider;
  error?: unknown;
  usage?: SmartRouterUsage;
}

export interface SmartRouterOptions {
  deployments: SmartRouterDeployment[];
  retries?: number;
  timeoutMs?: number;
  callbacks?: {
    sentry?: (event: SmartRouterLogEvent) => void;
    posthog?: (event: SmartRouterLogEvent) => void;
  };
}

export interface SmartRouterConfig {
  deployments: SmartRouterDeployment[];
  retries?: number;
  timeoutMs?: number;
  callbacks?: SmartRouterOptions["callbacks"];
}

export function createSmartRouterFromConfig(
  config: SmartRouterConfig,
): SmartRouter {
  return new SmartRouter(config);
}

const DEFAULT_TIMEOUT_MS = 30000;

export class SmartRouter {
  private deployments: SmartRouterDeployment[];
  private retries: number;
  private timeoutMs: number;
  private callbacks: SmartRouterOptions["callbacks"];
  private usageByDeployment = new Map<string, number>();

  constructor(options: SmartRouterOptions) {
    if (!options.deployments.length) {
      throw new Error("SmartRouter requires at least one deployment");
    }

    this.deployments = options.deployments.map((deployment) => ({
      ...deployment,
      tokenUsage: deployment.tokenUsage ?? 0,
    }));
    this.retries = options.retries ?? 2;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.callbacks = options.callbacks;

    for (const deployment of this.deployments) {
      this.usageByDeployment.set(deployment.id, deployment.tokenUsage ?? 0);
    }
  }

  getUsage(deploymentId: string): number {
    return this.usageByDeployment.get(deploymentId) ?? 0;
  }

  async chat(request: SmartRouterRequest): Promise<SmartRouterResponse> {
    const response = await this.run(request, false);
    return response as SmartRouterResponse;
  }

  async stream(request: SmartRouterRequest): Promise<AsyncIterable<unknown>> {
    const response = await this.run({ ...request, stream: true }, true);
    return response as AsyncIterable<unknown>;
  }

  private async run(
    request: SmartRouterRequest,
    streaming: boolean,
  ): Promise<SmartRouterResponse | AsyncIterable<unknown>> {
    const attempted = new Set<string>();
    let lastError: unknown;

    while (attempted.size < this.deployments.length) {
      const deployment = this.pickDeployment(attempted);
      if (!deployment) break;
      attempted.add(deployment.id);

      this.emit({
        event: "deployment_attempt",
        deploymentId: deployment.id,
        provider: deployment.provider,
      });

      for (let attempt = 0; attempt <= this.retries; attempt++) {
        try {
          const raw = await this.invokeDeployment(deployment, request);
          const normalized = this.normalizeResponse(raw);
          this.addUsage(deployment.id, normalized.usage);
          this.emit({
            event: "deployment_success",
            deploymentId: deployment.id,
            provider: deployment.provider,
            usage: normalized.usage,
          });

          if (streaming) return raw as AsyncIterable<unknown>;

          return {
            ...normalized,
            deploymentId: deployment.id,
            provider: deployment.provider,
            raw,
          };
        } catch (error) {
          lastError = error;
          if (this.isRateLimit(error)) {
            this.emit({
              event: "deployment_rate_limited",
              deploymentId: deployment.id,
              provider: deployment.provider,
              error,
            });
            break;
          }

          this.emit({
            event: "deployment_failed",
            deploymentId: deployment.id,
            provider: deployment.provider,
            error,
          });

          if (attempt === this.retries) break;
        }
      }
    }

    throw (
      lastError ??
      new Error("No SmartRouter deployment could handle the request")
    );
  }

  private pickDeployment(
    attempted: Set<string>,
  ): SmartRouterDeployment | undefined {
    return this.deployments
      .filter((deployment) => {
        if (attempted.has(deployment.id)) return false;
        const usage = this.getUsage(deployment.id);
        return (
          deployment.tokenLimit === undefined || usage < deployment.tokenLimit
        );
      })
      .sort((a, b) => this.getUsage(a.id) - this.getUsage(b.id))[0];
  }

  private async invokeDeployment(
    deployment: SmartRouterDeployment,
    request: SmartRouterRequest,
  ): Promise<unknown> {
    if (deployment.handler) return deployment.handler(request, deployment);

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      deployment.timeoutMs ?? this.timeoutMs,
    );

    try {
      const response = await axios.post(
        this.endpointFor(deployment),
        this.payloadFor(deployment, request),
        {
          headers: this.headersFor(deployment),
          signal: controller.signal,
        },
      );
      return response.data;
    } finally {
      clearTimeout(timeout);
    }
  }

  private endpointFor(deployment: SmartRouterDeployment): string {
    if (deployment.baseUrl) return deployment.baseUrl;
    if (deployment.provider === "google") {
      return "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent";
    }
    if (deployment.provider === "cohere") {
      return "https://api.cohere.ai/v1/chat";
    }
    return "https://api.openai.com/v1/chat/completions";
  }

  private headersFor(
    deployment: SmartRouterDeployment,
  ): Record<string, string> {
    if (deployment.provider === "google") {
      return {
        "Content-Type": "application/json",
        "x-goog-api-key": deployment.apiKey,
      };
    }

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${deployment.apiKey}`,
    };
  }

  private payloadFor(
    deployment: SmartRouterDeployment,
    request: SmartRouterRequest,
  ): Record<string, unknown> {
    if (deployment.provider === "google") {
      return {
        contents: [
          {
            role: "user",
            parts: [{ text: request.prompt ?? "" }],
          },
        ],
      };
    }

    if (deployment.provider === "cohere") {
      return {
        model: request.model ?? deployment.model,
        message: request.prompt,
        stream: request.stream ?? false,
      };
    }

    return {
      ...request,
      model: request.model ?? deployment.model ?? "gpt-3.5-turbo",
      messages:
        request.messages ??
        (request.prompt
          ? [{ role: "user", content: request.prompt }]
          : undefined),
    };
  }

  private normalizeResponse(raw: unknown): {
    content: unknown;
    usage?: SmartRouterUsage;
  } {
    const response = raw as any;
    const usage = response?.usage ?? response?.usageMetadata;

    if (response?.content !== undefined) {
      return { content: response.content, usage };
    }

    const openAiMessage = response?.choices?.[0]?.message?.content;
    if (openAiMessage !== undefined) {
      return { content: openAiMessage, usage };
    }

    const googleMessage = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (googleMessage !== undefined) {
      return {
        content: googleMessage,
        usage: usage
          ? {
              prompt_tokens: usage.promptTokenCount,
              completion_tokens: usage.candidatesTokenCount,
              total_tokens: usage.totalTokenCount,
            }
          : undefined,
      };
    }

    const cohereMessage = response?.text;
    if (cohereMessage !== undefined) {
      return {
        content: cohereMessage,
        usage: response?.meta?.billed_units
          ? { total_tokens: response.meta.billed_units.input_tokens ?? 0 }
          : undefined,
      };
    }

    return { content: raw, usage };
  }

  private addUsage(deploymentId: string, usage?: SmartRouterUsage): void {
    const totalTokens = usage?.total_tokens;
    if (!totalTokens) return;

    this.usageByDeployment.set(
      deploymentId,
      this.getUsage(deploymentId) + totalTokens,
    );
  }

  private isRateLimit(error: unknown): boolean {
    const err = error as any;
    return err?.response?.status === 429 || err?.status === 429;
  }

  private emit(event: SmartRouterLogEvent): void {
    this.callbacks?.sentry?.(event);
    this.callbacks?.posthog?.(event);
  }
}
