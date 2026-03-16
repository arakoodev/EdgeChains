import { SentryLogger } from "./SentryLogger.js";
import { PosthogLogger } from "./PosthogLogger.js";
import { CallbackConfig, LogPayload, CallbackEvent } from "../types.js";

export class CallbackManager {
  private sentryLogger?: SentryLogger;
  private posthogLogger?: PosthogLogger;

  constructor(config?: CallbackConfig) {
    if (config?.sentry?.enabled && config.sentry.dsn) {
      this.sentryLogger = new SentryLogger(
        config.sentry.dsn,
        config.sentry.enabled,
      );
    }

    if (config?.posthog?.enabled && config.posthog.apiKey) {
      this.posthogLogger = new PosthogLogger(
        config.posthog.apiKey,
        config.posthog.apiHost || "https://app.posthog.com",
        config.posthog.enabled,
      );
    }
  }

  async logPreCall(payload: Partial<LogPayload>): Promise<void> {
    if (this.sentryLogger) {
      this.sentryLogger.logPreCall(payload);
    }
    if (this.posthogLogger) {
      await this.posthogLogger.logPreCall(payload);
    }
  }

  async logPostCall(payload: LogPayload): Promise<void> {
    if (this.sentryLogger) {
      this.sentryLogger.logPostCall(payload);
    }
    if (this.posthogLogger) {
      await this.posthogLogger.logPostCall(payload);
    }
  }

  async logSuccess(payload: LogPayload): Promise<void> {
    if (this.sentryLogger) {
      this.sentryLogger.logSuccess(payload);
    }
    if (this.posthogLogger) {
      await this.posthogLogger.logSuccess(payload);
      await this.posthogLogger.flush();
    }
  }

  async logFailure(payload: LogPayload, error: Error | string): Promise<void> {
    const errorMessage = typeof error === "string" ? error : error.message;

    if (this.sentryLogger) {
      this.sentryLogger.logFailure(
        payload,
        error instanceof Error ? error : new Error(errorMessage),
      );
    }
    if (this.posthogLogger) {
      await this.posthogLogger.logFailure(payload, errorMessage);
      await this.posthogLogger.flush();
    }
  }

  isEnabled(): boolean {
    return !!this.sentryLogger || !!this.posthogLogger;
  }

  shutdown(): void {
    if (this.posthogLogger) {
      this.posthogLogger.shutdown();
    }
  }
}
