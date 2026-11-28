import { TokenUsage } from "../types.js";

export class TokenTracker {
  private usage: Map<string, TokenUsage> = new Map();
  private totalCost: number = 0;

  record(deploymentId: string, usage: TokenUsage): void {
    const existing = this.usage.get(deploymentId) || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    existing.promptTokens += usage.promptTokens;
    existing.completionTokens += usage.completionTokens;
    existing.totalTokens += usage.totalTokens;
    this.usage.set(deploymentId, existing);

    const rate = 0.002 / 1000;
    this.totalCost += usage.totalTokens * rate;
  }

  getUsage(deploymentId: string): TokenUsage {
    return this.usage.get(deploymentId) || { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }

  getAllUsage(): Record<string, TokenUsage> {
    return Object.fromEntries(this.usage);
  }

  getTotalCost(): number {
    return this.totalCost;
  }

  getDeploymentWithLeastTokens(): string | null {
    let min: string | null = null;
    let minTokens = Infinity;
    for (const [id, u] of this.usage) {
      if (u.totalTokens < minTokens) {
        minTokens = u.totalTokens;
        min = id;
      }
    }
    return min;
  }
}
