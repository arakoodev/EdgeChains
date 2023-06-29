package com.edgechain.lib.openai.endpoint;

import com.edgechain.lib.openai.providers.OpenAiChatCompletionProvider;
import com.edgechain.lib.openai.providers.OpenAiChatCompletionStreamProvider;
import com.edgechain.lib.openai.providers.OpenAiCompletionProvider;
import com.edgechain.lib.embeddings.providers.OpenAiEmbeddingProvider;
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
  private Boolean stream;

  public Endpoint() {}

  public Endpoint(RetryPolicy retryPolicy) {
    this.retryPolicy = retryPolicy;
  }

  public Endpoint(String url) {
    this(url, null, null, null, null, new FixedDelay(3, 4, TimeUnit.SECONDS));
  }

  public Endpoint(String url, String apiKey) {
    this(url, apiKey, null, null, null, new FixedDelay(3, 4, TimeUnit.SECONDS));
  }

  public Endpoint(String url, String apiKey, RetryPolicy retryPolicy) {
    this(url, apiKey, null, null, null, retryPolicy);
  }

  public Endpoint(String url, RetryPolicy retryPolicy) {
    this(url, null, null, null, null, retryPolicy);
  }

  public Endpoint(String url, String apiKey, String model, RetryPolicy retryPolicy) {
    this(url, apiKey, model, null, null, null, retryPolicy);
  }

  public Endpoint(String url, String apiKey, String model, String role, Double temperature, RetryPolicy retryPolicy) {
    this(url, apiKey, model, role, temperature, false, retryPolicy);
  }

  public Endpoint(
      String url,
      String apiKey,
      String model,
      String role,
      Double temperature,
      Boolean stream,
      RetryPolicy retryPolicy) {
    this.url = url;
    this.apiKey = apiKey;
    this.retryPolicy = retryPolicy;
    this.model = model;
    this.role = role;
    this.temperature = temperature;
    this.stream = stream;

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

  public Boolean getStream() {
    return stream;
  }

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("Endpoint{");
    sb.append("url='").append(url).append('\'');
    sb.append(", apiKey='").append(apiKey).append('\'');
    sb.append(", retryPolicy=").append(retryPolicy);
    sb.append(", model='").append(model).append('\'');
    sb.append(", role='").append(role).append('\'');
    sb.append(", temperature=").append(temperature);
    sb.append(", stream=").append(stream);
    sb.append('}');
    return sb.toString();
  }
}
