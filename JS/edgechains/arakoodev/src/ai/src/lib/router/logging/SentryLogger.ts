import * as Sentry from "@sentry/node";
import { LogPayload, CallbackEvent } from "../types.js";

export class SentryLogger {
  private enabled: boolean = false;
  private dsn?: string;

  constructor(dsn?: string, enabled: boolean = true) {
    if (dsn) {
      this.dsn = dsn;
      this.enabled = enabled;
      Sentry.init({
        dsn: this.dsn,
        tracesSampleRate: 1.0,
      });
    }
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  setDsn(dsn: string): void {
    this.dsn = dsn;
    Sentry.init({
      dsn: this.dsn,
      tracesSampleRate: 1.0,
    });
  }

  addBreadcrumb(
    message: string,
    level: Sentry.SeverityLevel = "info",
    data?: Record<string, any>,
  ): void {
    if (!this.enabled) return;

    Sentry.addBreadcrumb({
      message,
      level,
      data,
    });
  }

  logSuccess(payload: LogPayload): void {
    if (!this.enabled) return;

    this.addBreadcrumb(`LLM Call Success: ${payload.model}`, "info", {
      provider: payload.provider,
      deployment: payload.deployment,
      latency: payload.latency,
      tokens: payload.tokens?.totalTokens,
      cost: payload.tokens?.costUSD,
    });
  }

  logFailure(payload: LogPayload, error: Error): void {
    if (!this.enabled) return;

    Sentry.captureException(error, {
      extra: {
        model: payload.model,
        provider: payload.provider,
        deployment: payload.deployment,
        latency: payload.latency,
        tokens: payload.tokens,
      },
    });

    this.addBreadcrumb(`LLM Call Failed: ${payload.model}`, "error", {
      provider: payload.provider,
      deployment: payload.deployment,
      error: error.message,
    });
  }

  logPreCall(payload: Partial<LogPayload>): void {
    if (!this.enabled) return;

    this.addBreadcrumb(`LLM Pre-Call: ${payload.model}`, "info", {
      provider: payload.provider,
      deployment: payload.deployment,
    });
  }

  logPostCall(payload: LogPayload): void {
    if (!this.enabled) return;

    this.addBreadcrumb(`LLM Post-Call: ${payload.model}`, "info", {
      provider: payload.provider,
      deployment: payload.deployment,
      latency: payload.latency,
      status: payload.status,
    });
  }
}
