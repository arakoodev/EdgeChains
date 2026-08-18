import {
  RouterConfig,
  DeploymentConfig,
  Deployment,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  RoutingStrategy,
  TokenUsage,
  ChatMessage,
} from "./types.js";
import { OpenAIProvider } from "./providers/OpenAIProvider.js";
import { GeminiProvider } from "./providers/GeminiProvider.js";
import { CohereProvider } from "./providers/CohereProvider.js";
import { CallbackManager } from "./logging/CallbackManager.js";

type Provider = OpenAIProvider | GeminiProvider | CohereProvider;

export class Router {
  private deployments: Map<string, Deployment[]>;
  private config: Required<RouterConfig>;
  private callbackManager?: CallbackManager;
  private providers: Map<string, Provider>;

  constructor(config: RouterConfig) {
    this.config = {
      modelList: config.modelList || [],
      routingStrategy: config.routingStrategy || "least-tokens",
      numRetries: config.numRetries ?? 3,
      timeout: config.timeout ?? 30000,
      cooldownTime: config.cooldownTime ?? 60,
      allowedFails: config.allowedFails ?? 3,
      callbacks: config.callbacks || {},
    };

    this.deployments = new Map();
    this.providers = new Map();

    this.initializeDeployments();

    if (config.callbacks) {
      this.callbackManager = new CallbackManager(config.callbacks);
    }
  }

  private initializeDeployments(): void {
    const modelGroups = new Map<string, DeploymentConfig[]>();

    for (const modelConfig of this.config.modelList) {
      const existing = modelGroups.get(modelConfig.modelName) || [];
      existing.push(modelConfig);
      modelGroups.set(modelConfig.modelName, existing);
    }

    for (const [modelName, configs] of modelGroups) {
      const deployments: Deployment[] = configs.map((config) => ({
        config,
        currentTokens: 0,
        currentRequests: 0,
        failures: 0,
      }));
      this.deployments.set(modelName, deployments);
    }
  }

  private getProvider(config: DeploymentConfig): Provider {
    const key = `${config.provider}-${config.apiKey}-${config.apiBase || "default"}`;

    if (this.providers.has(key)) {
      return this.providers.get(key)!;
    }

    let provider: Provider;

    switch (config.provider) {
      case "openai":
        provider = new OpenAIProvider(
          config.apiKey,
          config.apiBase || "https://api.openai.com/v1",
          this.config.timeout,
          this.config.numRetries,
        );
        break;
      case "gemini":
        provider = new GeminiProvider(
          config.apiKey,
          config.apiBase || "https://generativelanguage.googleapis.com/v1",
          this.config.timeout,
          this.config.numRetries,
        );
        break;
      case "cohere":
        provider = new CohereProvider(
          config.apiKey,
          config.apiBase || "https://api.cohere.ai/v1",
          this.config.timeout,
          this.config.numRetries,
        );
        break;
      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }

    this.providers.set(key, provider);
    return provider;
  }

  private selectDeployment(modelName: string): Deployment | null {
    const deployments = this.deployments.get(modelName);
    if (!deployments || deployments.length === 0) {
      return null;
    }

    const now = Date.now();
    const active = deployments.filter(
      (d) => !d.cooldownUntil || d.cooldownUntil <= now,
    );

    if (active.length === 0) {
      return deployments[0];
    }

    const available = active.filter((d) => this.checkRateLimit(d));

    if (available.length === 0) {
      return active[0];
    }

    switch (this.config.routingStrategy) {
      case "least-tokens":
        return this.selectByLeastTokens(available);
      case "latency-based":
        return this.selectByLatency(available);
      case "simple-shuffle":
      default:
        return this.selectByShuffle(available);
    }
  }

  private selectByLeastTokens(deployments: Deployment[]): Deployment {
    return deployments.reduce((min, d) =>
      d.currentTokens < min.currentTokens ? d : min,
    );
  }

  private selectByLatency(deployments: Deployment[]): Deployment {
    return deployments.reduce((min, d) =>
      (d.latency || Infinity) < (min.latency || Infinity) ? d : min,
    );
  }

  private selectByShuffle(deployments: Deployment[]): Deployment {
    const index = Math.floor(Math.random() * deployments.length);
    return deployments[index];
  }

  private checkRateLimit(deployment: Deployment): boolean {
    if (
      deployment.config.rpm &&
      deployment.currentRequests >= deployment.config.rpm
    ) {
      return false;
    }
    if (
      deployment.config.tpm &&
      deployment.currentTokens >= deployment.config.tpm
    ) {
      return false;
    }
    return true;
  }

  private updateUsage(deployment: Deployment, usage: TokenUsage): void {
    deployment.currentTokens += usage.totalTokens;
    deployment.currentRequests += 1;
  }

  private handleFailure(deployment: Deployment): void {
    deployment.failures += 1;

    if (deployment.failures >= this.config.allowedFails) {
      deployment.cooldownUntil = Date.now() + this.config.cooldownTime * 1000;
      deployment.failures = 0;
    }
  }

  private resetDeployment(deployment: Deployment): void {
    deployment.currentTokens = 0;
    deployment.currentRequests = 0;
  }

  async completion(request: CompletionRequest): Promise<CompletionResponse> {
    const deployment = this.selectDeployment(request.model);

    if (!deployment) {
      throw new Error(
        `No available deployment found for model: ${request.model}`,
      );
    }

    const provider = this.getProvider(deployment.config);
    const startTime = Date.now();

    if (this.callbackManager) {
      await this.callbackManager.logPreCall({
        model: request.model,
        deployment: deployment.config.apiBase || deployment.config.modelName,
        provider: deployment.config.provider,
        startTime,
      });
    }

    try {
      deployment.currentRequests += 1;

      const response = await provider.completion(request);

      this.updateUsage(deployment, response.usage);
      deployment.failures = 0;
      deployment.lastLatency = Date.now() - startTime;
      deployment.latency = deployment.lastLatency;

      if (this.callbackManager) {
        await this.callbackManager.logSuccess({
          model: request.model,
          deployment: deployment.config.apiBase || deployment.config.modelName,
          provider: deployment.config.provider,
          tokens: response.usage,
          latency: Date.now() - startTime,
          status: "success",
          startTime,
          endTime: Date.now(),
        });
      }

      return response;
    } catch (error) {
      this.handleFailure(deployment);

      if (this.callbackManager) {
        await this.callbackManager.logFailure(
          {
            model: request.model,
            deployment:
              deployment.config.apiBase || deployment.config.modelName,
            provider: deployment.config.provider,
            latency: Date.now() - startTime,
            status: "failure",
            error: error instanceof Error ? error.message : String(error),
            startTime,
            endTime: Date.now(),
          },
          error instanceof Error ? error : new Error(String(error)),
        );
      }

      throw error;
    }
  }

  async *streamingCompletion(
    request: CompletionRequest,
  ): AsyncGenerator<StreamChunk> {
    const deployment = this.selectDeployment(request.model);

    if (!deployment) {
      throw new Error(
        `No available deployment found for model: ${request.model}`,
      );
    }

    const provider = this.getProvider(deployment.config);
    const startTime = Date.now();

    if (this.callbackManager) {
      await this.callbackManager.logPreCall({
        model: request.model,
        deployment: deployment.config.apiBase || deployment.config.modelName,
        provider: deployment.config.provider,
        startTime,
      });
    }

    try {
      deployment.currentRequests += 1;

      let totalUsage: TokenUsage = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        costUSD: 0,
      };

      for await (const chunk of provider.streamingCompletion(request)) {
        if (chunk.usage) {
          totalUsage.promptTokens += chunk.usage.promptTokens || 0;
          totalUsage.completionTokens += chunk.usage.completionTokens || 0;
          totalUsage.totalTokens += chunk.usage.totalTokens || 0;
          totalUsage.costUSD += chunk.usage.costUSD || 0;
        }
        yield chunk;
      }

      this.updateUsage(deployment, totalUsage);
      deployment.failures = 0;
      deployment.lastLatency = Date.now() - startTime;
      deployment.latency = deployment.lastLatency;

      if (this.callbackManager) {
        await this.callbackManager.logSuccess({
          model: request.model,
          deployment: deployment.config.apiBase || deployment.config.modelName,
          provider: deployment.config.provider,
          tokens: totalUsage,
          latency: Date.now() - startTime,
          status: "success",
          startTime,
          endTime: Date.now(),
        });
      }
    } catch (error) {
      this.handleFailure(deployment);

      if (this.callbackManager) {
        await this.callbackManager.logFailure(
          {
            model: request.model,
            deployment:
              deployment.config.apiBase || deployment.config.modelName,
            provider: deployment.config.provider,
            latency: Date.now() - startTime,
            status: "failure",
            error: error instanceof Error ? error.message : String(error),
            startTime,
            endTime: Date.now(),
          },
          error instanceof Error ? error : new Error(String(error)),
        );
      }

      throw error;
    }
  }

  getDeploymentStatus(modelName: string): any[] {
    const deployments = this.deployments.get(modelName);
    if (!deployments) return [];

    return deployments.map((d) => ({
      provider: d.config.provider,
      apiBase: d.config.apiBase,
      currentTokens: d.currentTokens,
      currentRequests: d.currentRequests,
      failures: d.failures,
      cooldownUntil: d.cooldownUntil,
      latency: d.latency,
      rpm: d.config.rpm,
      tpm: d.config.tpm,
    }));
  }

  resetUsage(modelName?: string): void {
    if (modelName) {
      const deployments = this.deployments.get(modelName);
      if (deployments) {
        for (const d of deployments) {
          this.resetDeployment(d);
        }
      }
    } else {
      for (const deployments of this.deployments.values()) {
        for (const d of deployments) {
          this.resetDeployment(d);
        }
      }
    }
  }

  shutdown(): void {
    if (this.callbackManager) {
      this.callbackManager.shutdown();
    }
  }
}
