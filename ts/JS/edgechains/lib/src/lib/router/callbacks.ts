import * as Sentry from '@sentry/node'; // Use @sentry/browser for client-side
import { PostHog } from 'posthog-node';
import { ICallback, SentryConfig, PosthogConfig, ChatCompletionRequest, ChatCompletionResponse, ChatCompletionStreamChunk, TokenUsage, LLMProvider } from './types';

/**
 * Manages and dispatches events to registered callbacks.
 */
export class CallbackManager {
  private callbacks: ICallback[] = [];

  constructor(callbacks: ICallback[] = []) {
    this.callbacks = callbacks;
  }

  addCallback(callback: ICallback): void {
    this.callbacks.push(callback);
  }

  async onStart(
    deploymentId: string,
    provider: LLMProvider,
    model: string,
    request: ChatCompletionRequest,
    metadata?: Record<string, any>
  ): Promise<void> {
    for (const callback of this.callbacks) {
      try {
        await callback.onStart(deploymentId, provider, model, request, metadata);
      } catch (e) {
        console.error(`CallbackManager: Error in onStart for ${callback.constructor.name}:`, e);
      }
    }
  }

  async onSuccess(
    deploymentId: string,
    provider: LLMProvider,
    model: string,
    request: ChatCompletionRequest,
    response: ChatCompletionResponse | ChatCompletionStreamChunk[],
    tokenUsage?: TokenUsage,
    durationMs?: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    for (const callback of this.callbacks) {
      try {
        await callback.onSuccess(deploymentId, provider, model, request, response, tokenUsage, durationMs, metadata);
      } catch (e) {
        console.error(`CallbackManager: Error in onSuccess for ${callback.constructor.name}:`, e);
      }
    }
  }

  async onError(
    deploymentId: string | undefined,
    provider: LLMProvider | undefined,
    model: string | undefined,
    request: ChatCompletionRequest,
    error: any,
    durationMs?: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    for (const callback of this.callbacks) {
      try {
        await callback.onError(deploymentId, provider, model, request, error, durationMs, metadata);
      } catch (e) {
        console.error(`CallbackManager: Error in onError for ${callback.constructor.name}:`, e);
      }
    }
  }
}

/**
 * Sentry callback implementation.
 */
export class SentryCallback implements ICallback {
  private isInitialized = false;

  constructor(private config: SentryConfig) {
    if (this.config.enabled && this.config.dsn) {
      Sentry.init({
        dsn: this.config.dsn,
        environment: this.config.environment || 'production',
        release: this.config.release,
        // Add other Sentry options as needed
      });
      this.isInitialized = true;
      console.log('SentryCallback: Sentry initialized.');
    } else {
      console.warn('SentryCallback: Sentry not initialized. DSN is missing or disabled.');
    }
  }

  onStart(
    deploymentId: string,
    provider: LLMProvider,
    model: string,
    request: ChatCompletionRequest,
    metadata?: Record<string, any>
  ): void {
    if (!this.isInitialized) return;
    Sentry.addBreadcrumb({
      category: 'llm',
      message: 'LLM request started',
      data: { deploymentId, provider, model, request, metadata },
      level: 'info',
    });
  }

  onSuccess(
    deploymentId: string,
    provider: LLMProvider,
    model: string,
    request: ChatCompletionRequest,
    response: ChatCompletionResponse | ChatCompletionStreamChunk[],
    tokenUsage?: TokenUsage,
    durationMs?: number,
    metadata?: Record<string, any>
  ): void {
    if (!this.isInitialized) return;
    Sentry.addBreadcrumb({
      category: 'llm',
      message: 'LLM request successful',
      data: { deploymentId, provider, model, request, response, tokenUsage, durationMs, metadata },
      level: 'info',
    });
  }

  onError(
    deploymentId: string | undefined,
    provider: LLMProvider | undefined,
    model: string | undefined,
    request: ChatCompletionRequest,
    error: any,
    durationMs?: number,
    metadata?: Record<string, any>
  ): void {
    if (!this.isInitialized) return;
    Sentry.captureException(error, {
      extra: {
        deploymentId,
        provider,
        model,
        request,
        durationMs,
        metadata,
      },
      tags: {
        llm_provider: provider,
        llm_model: model,
        llm_deployment_id: deploymentId,
        error_type: error?.name || 'UnknownError',
        status_code: error?.response?.status,
      },
    });
  }
}

/**
 * Posthog callback implementation.
 */
export class PosthogCallback implements ICallback {
  private posthog: PostHog | undefined;
  private isInitialized = false;

  constructor(private config: PosthogConfig) {
    if (this.config.enabled && this.config.apiKey && this.config.host) {
      this.posthog = new PostHog(this.config.apiKey, { host: this.config.host });
      this.isInitialized = true;
      console.log('PosthogCallback: Posthog initialized.');
    } else {
      console.warn('PosthogCallback: Posthog not initialized. API key or host is missing or disabled.');
    }
  }

  onStart(
    deploymentId: string,
    provider: LLMProvider,
    model: string,
    request: ChatCompletionRequest,
    metadata?: Record<string, any>
  ): void {
    if (!this.isInitialized || !this.posthog) return;
    this.posthog.capture({
      event: 'llm_request_start',
      properties: {
        deployment_id: deploymentId,
        provider,
        model,
        request_messages: request.messages.map(m => m.content),
        request_model: request.model,
        request_stream: request.stream,
        ...metadata,
      },
    });
  }

  onSuccess(
    deploymentId: string,
    provider: LLMProvider,
    model: string,
    request: ChatCompletionRequest,
    response: ChatCompletionResponse | ChatCompletionStreamChunk[],
    tokenUsage?: TokenUsage,
    durationMs?: number,
    metadata?: Record<string, any>
  ): void {
    if (!this.isInitialized || !this.posthog) return;

    let responseContent: string | undefined;
    if (Array.isArray(response)) {
      responseContent = response.map(chunk => chunk.choices[0]?.delta?.content || '').join('');
    } else {
      responseContent = response.choices[0]?.message?.content;
    }

    this.posthog.capture({
      event: 'llm_request_success',
      properties: {
        deployment_id: deploymentId,
        provider,
        model,
        request_messages: request.messages.map(m => m.content),
        request_model: request.model,
        request_stream: request.stream,
        response_content: responseContent,
        token_usage_prompt: tokenUsage?.promptTokens,
        token_usage_completion: tokenUsage?.completionTokens,
        token_usage_total: tokenUsage?.totalTokens,
        duration_ms: durationMs,
        ...metadata,
      },
    });
  }

  onError(
    deploymentId: string | undefined,
    provider: LLMProvider | undefined,
    model: string | undefined,
    request: ChatCompletionRequest,
    error: any,
    durationMs?: number,
    metadata?: Record<string, any>
  ): void {
    if (!this.isInitialized || !this.posthog) return;
    this.posthog.capture({
      event: 'llm_request_error',
      properties: {
        deployment_id: deploymentId,
        provider,
        model,
        request_messages: request.messages.map(m => m.content),
        request_model: request.model,
        request_stream: request.stream,
        error_message: error?.message,
        error_stack: error?.stack,
        error_status: error?.response?.status,
        duration_ms: durationMs,
        ...metadata,
      },
    });
  }
}
