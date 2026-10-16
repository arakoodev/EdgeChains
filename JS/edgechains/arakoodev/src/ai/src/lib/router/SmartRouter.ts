import { DeploymentConfig, RouterChatOptions, RouterStreamChunk, TokenUsage, LogEvent, BaseProvider } from "./types.js";
import { OpenAIProvider } from "./providers/openai.js";
import { GeminiProvider } from "./providers/gemini.js";
import { CohereProvider } from "./providers/cohere.js";
import { TokenTracker } from "./middleware/tokenTracker.js";
import { Logger } from "./middleware/logger.js";

export class SmartRouter {
  private deployments: BaseProvider[] = [];
  private tokenTracker: TokenTracker;
  private logger: Logger;
  private rateLimitMap: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(configs: DeploymentConfig[]) {
    this.tokenTracker = new TokenTracker();
    this.logger = new Logger();

    for (const config of configs) {
      const provider = this.createProvider(config);
      if (provider) this.deployments.push(provider);
    }
  }

  private createProvider(config: DeploymentConfig): BaseProvider | null {
    switch (config.provider) {
      case "openai": return new OpenAIProvider(config);
      case "gemini": return new GeminiProvider(config);
      case "cohere": return new CohereProvider(config);
      default: return null;
    }
  }

  private selectDeployment(): BaseProvider {
    const leastTokens = this.tokenTracker.getDeploymentWithLeastTokens();
    const eligible = this.deployments.filter(d => {
      const id = d.getDeploymentId();
      const rl = this.rateLimitMap.get(id);
      if (!rl) return true;
      if (Date.now() > rl.resetAt) {
        this.rateLimitMap.delete(id);
        return true;
      }
      return rl.count < 60;
    });

    if (eligible.length === 0) {
      const fallback = this.deployments[0];
      this.logger.log({ type: "rate_limit", provider: fallback.name, model: "", timestamp: new Date().toISOString(), error: "All deployments rate-limited, using first" });
      return fallback;
    }

    if (leastTokens) {
      const best = eligible.find(d => d.getDeploymentId() === leastTokens);
      if (best) {
        this.logger.log({ type: "deployment_switch", provider: best.name, model: "", timestamp: new Date().toISOString(), deploymentId: best.getDeploymentId() });
        return best;
      }
    }

    return eligible[0];
  }

  private trackRateLimit(deploymentId: string): void {
    const rl = this.rateLimitMap.get(deploymentId) || { count: 0, resetAt: Date.now() + 60000 };
    rl.count++;
    this.rateLimitMap.set(deploymentId, rl);
  }

  useLogger(cb: (event: LogEvent) => void | Promise<void>): void {
    this.logger.use(cb);
  }

  getLogger(): Logger {
    return this.logger;
  }

  getTokenTracker(): TokenTracker {
    return this.tokenTracker;
  }

  async chat(options: RouterChatOptions): Promise<{ content: string; usage?: TokenUsage }> {
    const deployment = this.selectDeployment();
    const start = Date.now();
    const deploymentId = deployment.getDeploymentId();

    try {
      this.trackRateLimit(deploymentId);
      const result = await deployment.chat(options);
      const duration = Date.now() - start;

      if (result.usage) {
        this.tokenTracker.record(deploymentId, result.usage);
      }

      this.logger.log({
        type: "completion",
        provider: deployment.name,
        model: this.getModelName(options),
        timestamp: new Date().toISOString(),
        durationMs: duration,
        tokens: result.usage,
        deploymentId,
      });

      return result;
    } catch (error: any) {
      this.logger.log({
        type: "error",
        provider: deployment.name,
        model: this.getModelName(options),
        timestamp: new Date().toISOString(),
        error: error.message,
        deploymentId,
      });

      const fallback = this.deployments.find(d => d.getDeploymentId() !== deploymentId);
      if (fallback) {
        this.logger.log({ type: "deployment_switch", provider: fallback.name, model: this.getModelName(options), timestamp: new Date().toISOString(), deploymentId: fallback.getDeploymentId() });
        return fallback.chat(options);
      }
      throw error;
    }
  }

  async *streamChat(options: RouterChatOptions): AsyncGenerator<RouterStreamChunk> {
    const deployment = this.selectDeployment();
    const deploymentId = deployment.getDeploymentId();

    try {
      this.trackRateLimit(deploymentId);
      const stream = deployment.streamChat(options);
      let fullContent = "";
      for await (const chunk of stream) {
        fullContent += chunk.content;
        yield chunk;
      }

      const usage: TokenUsage = { promptTokens: 0, completionTokens: fullContent.length / 4, totalTokens: fullContent.length / 4 };
      this.tokenTracker.record(deploymentId, usage);

      this.logger.log({
        type: "completion",
        provider: deployment.name,
        model: this.getModelName(options),
        timestamp: new Date().toISOString(),
        tokens: usage,
        deploymentId,
      });
    } catch (error: any) {
      this.logger.log({
        type: "error",
        provider: deployment.name,
        model: this.getModelName(options),
        timestamp: new Date().toISOString(),
        error: error.message,
        deploymentId,
      });
      throw error;
    }
  }

  getDeployments(): BaseProvider[] {
    return this.deployments;
  }

  private getModelName(options: RouterChatOptions): string {
    return options.model || "default";
  }
}
