package com.edgechain.lib.openai.endpoint;

import com.edgechain.lib.openai.providers.OpenAiChatCompletionProvider;
import com.edgechain.lib.openai.providers.OpenAiCompletionProvider;
import com.edgechain.lib.openai.providers.OpenAiEmbeddingProvider;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import com.edgechain.lib.rxjava.retry.impl.FixedDelay;

import java.util.Objects;
import java.util.concurrent.TimeUnit;

public class Endpoint {
  private String url;
  private String apiKey;
  private RetryPolicy retryPolicy;
  private String model;
  private String role;
  private Double temperature;
  private ChainProvider chainProvider;

  public Endpoint() {}

  public Endpoint(String url) {
    this(url, null, null, null, new FixedDelay(3, 4, TimeUnit.SECONDS));
  }

  public Endpoint(String url, String apiKey) {
    this(url, apiKey, null, null, new FixedDelay(3, 4, TimeUnit.SECONDS));
  }

  public Endpoint(String url, String apiKey, RetryPolicy retryPolicy) {
    this(url, apiKey, null, null, retryPolicy);
  }

  public Endpoint(String url, RetryPolicy retryPolicy) {
    this(url, null, null, null, retryPolicy);
  }

  public Endpoint(String url, String apiKey, String model, RetryPolicy retryPolicy) {
    this(url, apiKey, model, null, null, retryPolicy);
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

    if (Objects.isNull(role) && Objects.isNull(temperature)) {
      this.chainProvider = new OpenAiEmbeddingProvider(this);
    } else if (Objects.isNull(role)) {
      this.chainProvider = new OpenAiCompletionProvider(this);
    } else {
      this.chainProvider = new OpenAiChatCompletionProvider(this);
    }
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
        + "}";
  }
}
