package com.app.openai.endpoint;

import com.app.openai.llm.provider.LLMProvider;
import com.app.openai.llm.provider.impl.OpenAiChatCompletionProvider;
import com.app.rxjava.retry.RetryPolicy;

public class Endpoint {
  private final String url;
  private String apiKey;
  private final RetryPolicy retryPolicy;
  private final String model;
  private final String role;
  private final Double temperature;
  private final LLMProvider llmProvider;

  public Endpoint(String url) {
    this(url, null, null, null, null);
  }

  public Endpoint(String url, String apiKey) {
    this(url, apiKey, null, null, null);
  }

  public Endpoint(String url, String apiKey, RetryPolicy retryPolicy) {
    this(url, apiKey, null, null, retryPolicy);
  }

  public Endpoint(String url, RetryPolicy retryPolicy) {
    this(url, null, null, null, retryPolicy);
  }

  public Endpoint(String url, String apiKey, String model, String role, RetryPolicy retryPolicy) {
    this(url, apiKey, model, role, null, retryPolicy);
  }

  public Endpoint(
      String url,
      String apiKey,
      String model,
      String role,
      Double temperature,
      RetryPolicy retryPolicy) {
    this.url = url;
    this.apiKey = apiKey;
    this.retryPolicy = retryPolicy;
    this.model = model;
    this.role = role;
    this.temperature = temperature;
    this.llmProvider = new OpenAiChatCompletionProvider(this);
  }

  public String getApiKey() {
    return this.apiKey;
  }

  public String getUrl() {
    return this.url;
  }

  public RetryPolicy getRetryPolicy() {
    return this.retryPolicy;
  }

  public String getModel() {
    return this.model;
  }

  public String getRole() {
    return this.role;
  }

  public Double getTemperature() {
    return this.temperature;
  }

  public LLMProvider getLlmProvider() {
    return this.llmProvider;
  }

  public String toString() {
    return "Endpoint{url='"
        + this.url
        + "', apiKey='"
        + this.apiKey
        + "', retryPolicy="
        + this.retryPolicy
        + ", model='"
        + this.model
        + "', role='"
        + this.role
        + "', temperature="
        + this.temperature
        + ", llmProvider="
        + this.llmProvider
        + "}";
  }
}
