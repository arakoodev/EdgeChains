import axios from "axios";

export type Provider = "openai" | "google" | "cohere";

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
  retryAt?: number;
}

export interface SmartRouterOptions {
  deployments: SmartRouterDeployment[];
  retries?: number;
  timeoutMs?: number;
  rateLimitCooldownMs?: number;
  callbacks?: {
    sentry?: (event: SmartRouterLogEvent) => void;
    posthog?: (event: SmartRouterLogEvent) => void;
  };
  now?: () => number;
}

export interface SmartRouterConfig {
  deployments: SmartRouterDeployment[];
  retries?: number;
  timeoutMs?: number;
  rateLimitCooldownMs?: number;
  callbacks?: SmartRouterOptions["callbacks"];
}

export function createSmartRouterFromConfig(
  config: SmartRouterConfig,
): SmartRouter {
  return new SmartRouter(config);
}

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 60000;

const isFiniteNonNegativeNumber = (value: number): boolean =>
  Number.isFinite(value) && value >= 0;

export class SmartRouter {
  private deployments: SmartRouterDeployment[];
  private retries: number;
  private timeoutMs: number;
  private rateLimitCooldownMs: number;
  private callbacks: SmartRouterOptions["callbacks"];
  private usageByDeployment = new Map<string, number>();
  private rateLimitedUntilByDeployment = new Map<string, number>();
  private now: () => number;

  constructor(options: SmartRouterOptions) {
    this.validateOptions(options);

    this.deployments = options.deployments.map((deployment) => ({
      ...deployment,
      tokenUsage: deployment.tokenUsage ?? 0,
    }));
    this.retries = options.retries ?? 2;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.rateLimitCooldownMs =
      options.rateLimitCooldownMs ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS;
    this.callbacks = options.callbacks;
    this.now = options.now ?? Date.now;

    for (const deployment of this.deployments) {
      this.usageByDeployment.set(deployment.id, deployment.tokenUsage ?? 0);
    }
  }

  getUsage(deploymentId: string): number {
    return this.usageByDeployment.get(deploymentId) ?? 0;
  }

  getRateLimitedUntil(deploymentId: string): number {
    return this.rateLimitedUntilByDeployment.get(deploymentId) ?? 0;
  }

  async chat(request: SmartRouterRequest): Promise<SmartRouterResponse> {
    const response = await this.run(request, false);
    return response as SmartRouterResponse;
  }

  async stream(request: SmartRouterRequest): Promise<AsyncIterable<unknown>> {
    const response = await this.run({ ...request, stream: true }, true);
    if (!this.isAsyncIterable(response)) {
      throw new Error("Selected deployment did not return an async iterable");
    }
    return response;
  }

  private validateOptions(options: SmartRouterOptions): void {
    if (
      !options ||
      !Array.isArray(options.deployments) ||
      !options.deployments.length
    ) {
      throw new Error("SmartRouter requires at least one deployment");
    }

    const retries = options.retries ?? 0;
    if (!Number.isInteger(retries) || retries < 0) {
      throw new Error("SmartRouter retries must be a non-negative integer");
    }

    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error("SmartRouter timeoutMs must be greater than zero");
    }

    const rateLimitCooldownMs =
      options.rateLimitCooldownMs ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS;
    if (!isFiniteNonNegativeNumber(rateLimitCooldownMs)) {
      throw new Error("SmartRouter rateLimitCooldownMs must be non-negative");
    }

    const deploymentIds = new Set<string>();
    for (const deployment of options.deployments) {
      if (!deployment.id) {
        throw new Error("SmartRouter deployment id is required");
      }
      if (deploymentIds.has(deployment.id)) {
        throw new Error(
          `Duplicate SmartRouter deployment id: ${deployment.id}`,
        );
      }
      deploymentIds.add(deployment.id);

      if (
        !isFiniteNonNegativeNumber(deployment.tokenLimit ?? 0) ||
        !isFiniteNonNegativeNumber(deployment.tokenUsage ?? 0)
      ) {
        throw new Error(
          "SmartRouter token limits and usage must be finite and non-negative",
        );
      }
      if (
        deployment.timeoutMs !== undefined &&
        (!Number.isFinite(deployment.timeoutMs) || deployment.timeoutMs <= 0)
      ) {
        throw new Error("Deployment timeoutMs must be greater than zero");
      }
    }
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
          if (streaming) {
            if (!this.isAsyncIterable(raw)) {
              throw new Error(
                `Deployment ${deployment.id} did not return an async iterable`,
              );
            }
            this.emit({
              event: "deployment_success",
              deploymentId: deployment.id,
              provider: deployment.provider,
            });
            return raw;
          }

          const normalized = this.normalizeResponse(raw);
          this.addUsage(deployment.id, normalized.usage);
          this.emit({
            event: "deployment_success",
            deploymentId: deployment.id,
            provider: deployment.provider,
            usage: normalized.usage,
          });

          return {
            ...normalized,
            deploymentId: deployment.id,
            provider: deployment.provider,
            raw,
          };
        } catch (error) {
          lastError = error;
          if (this.isRateLimit(error)) {
            const retryAt = this.markRateLimited(deployment.id, error);
            this.emit({
              event: "deployment_rate_limited",
              deploymentId: deployment.id,
              provider: deployment.provider,
              error,
              retryAt,
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
    const now = this.now();
    return this.deployments
      .filter((deployment) => {
        if (attempted.has(deployment.id)) return false;
        if (this.getRateLimitedUntil(deployment.id) > now) return false;
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
    const timeoutMs = deployment.timeoutMs ?? this.timeoutMs;

    if (deployment.handler) {
      return this.withTimeout(
        deployment.handler(request, deployment),
        timeoutMs,
        deployment.id,
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await axios.post(
        this.endpointFor(deployment, request),
        this.payloadFor(deployment, request),
        {
          headers: this.headersFor(deployment),
          signal: controller.signal,
          responseType: request.stream ? "stream" : "json",
        },
      );
      return response.data;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    deploymentId: string,
  ): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error(`Deployment ${deploymentId} timed out`)),
        timeoutMs,
      );
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private endpointFor(
    deployment: SmartRouterDeployment,
    request: SmartRouterRequest = {},
  ): string {
    if (deployment.baseUrl) return deployment.baseUrl;
    if (deployment.provider === "google") {
      const model = request.model ?? deployment.model ?? "gemini-pro";
      const method = request.stream
        ? "streamGenerateContent?alt=sse"
        : "generateContent";
      return `https://generativelanguage.googleapis.com/v1/models/${model}:${method}`;
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
      const messages =
        request.messages ??
        (request.prompt ? [{ role: "user", content: request.prompt }] : []);
      return {
        contents: messages.map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
      };
    }

    if (deployment.provider === "cohere") {
      return {
        model: request.model ?? deployment.model,
        message:
          request.prompt ??
          request.messages?.map((item) => item.content).join("\n"),
        stream: request.stream ?? false,
      };
    }

    const { prompt, messages, model, ...requestOptions } = request;
    return {
      ...requestOptions,
      model: model ?? deployment.model ?? "gpt-3.5-turbo",
      messages:
        messages ??
        (prompt ? [{ role: "user", content: prompt }] : undefined),
    };
  }

  private normalizeUsage(response: any): SmartRouterUsage | undefined {
    if (response?.usage) return response.usage;

    if (response?.usageMetadata) {
      return {
        prompt_tokens: response.usageMetadata.promptTokenCount,
        completion_tokens: response.usageMetadata.candidatesTokenCount,
        total_tokens: response.usageMetadata.totalTokenCount,
      };
    }

    const billedUnits = response?.meta?.billed_units;
    if (billedUnits) {
      const inputTokens = billedUnits.input_tokens ?? 0;
      const outputTokens = billedUnits.output_tokens ?? 0;
      return {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
      };
    }

    return undefined;
  }

  private normalizeResponse(raw: unknown): {
    content: unknown;
    usage?: SmartRouterUsage;
  } {
    const response = raw as any;
    const usage = this.normalizeUsage(response);

    if (response?.content !== undefined) {
      return { content: response.content, usage };
    }

    const openAiMessage = response?.choices?.[0]?.message?.content;
    if (openAiMessage !== undefined) {
      return { content: openAiMessage, usage };
    }

    const googleMessage = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (googleMessage !== undefined) {
      return { content: googleMessage, usage };
    }

    const cohereMessage = response?.text;
    if (cohereMessage !== undefined) {
      return { content: cohereMessage, usage };
    }

    return { content: raw, usage };
  }

  private addUsage(deploymentId: string, usage?: SmartRouterUsage): void {
    const totalTokens = usage?.total_tokens;
    if (totalTokens === undefined) return;

    this.usageByDeployment.set(
      deploymentId,
      this.getUsage(deploymentId) + totalTokens,
    );
  }

  private isRateLimit(error: unknown): boolean {
    const err = error as any;
    return err?.response?.status === 429 || err?.status === 429;
  }

  private markRateLimited(deploymentId: string, error: unknown): number {
    const retryAfterMs = this.getRetryAfterMs(error);
    const retryAt = this.now() + retryAfterMs;
    this.rateLimitedUntilByDeployment.set(deploymentId, retryAt);
    return retryAt;
  }

  private getRetryAfterMs(error: unknown): number {
    const headers = (error as any)?.response?.headers;
    const retryAfter =
      typeof headers?.get === "function"
        ? headers.get("retry-after")
        : headers?.["retry-after"] ?? headers?.["Retry-After"];
    if (retryAfter === undefined || retryAfter === null) {
      return this.rateLimitCooldownMs;
    }

    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

    const retryDate = Date.parse(String(retryAfter));
    if (Number.isNaN(retryDate)) return this.rateLimitCooldownMs;
    return Math.max(0, retryDate - this.now());
  }

  private isAsyncIterable(value: unknown): value is AsyncIterable<unknown> {
    return Boolean(
      value &&
        typeof (value as AsyncIterable<unknown>)[Symbol.asyncIterator] ===
          "function",
    );
  }

  private emit(event: SmartRouterLogEvent): void {
    for (const callback of [this.callbacks?.sentry, this.callbacks?.posthog]) {
      try {
        callback?.(event);
      } catch {
        // Observability hooks must never break routing or failover.
      }
    }
  }
}
