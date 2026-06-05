import { LogCallback, LogEvent } from "../types.js";

export class Logger {
  private callbacks: LogCallback[] = [];

  constructor() {
    this.callbacks = [];
  }

  use(cb: LogCallback): void {
    this.callbacks.push(cb);
  }

  async log(event: LogEvent): Promise<void> {
    for (const cb of this.callbacks) {
      try {
        await cb(event);
      } catch {}
    }
  }

  sentryLog(dsn?: string): LogCallback {
    return (event: LogEvent) => {
      if (event.type === "error" || event.type === "rate_limit") {
        console.error(`[sentry] ${event.type}:`, event.provider, event.error || "");
      }
    };
  }

  posthogLog(apiKey?: string, host?: string): LogCallback {
    return (event: LogEvent) => {
      const level = event.type === "error" ? "error" : "info";
      console.log(`[posthog] ${level}:`, event.provider, event.model, event.type);
    };
  }
}
