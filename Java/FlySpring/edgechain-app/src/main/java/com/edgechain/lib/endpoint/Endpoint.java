package com.edgechain.lib.endpoint;

import com.edgechain.lib.rxjava.retry.RetryPolicy;

import java.io.Serializable;

public class Endpoint implements Serializable {

  private static final long serialVersionUID = 8770981950923685799L;

  private String url;
  private String apiKey;
  private RetryPolicy retryPolicy;

  public Endpoint() {}

  public Endpoint(RetryPolicy retryPolicy) {
    this(null, null, retryPolicy);
  }

  public Endpoint(String url) {
    this(url, null, null);
  }

  public Endpoint(String url, RetryPolicy retryPolicy) {
    this(url, null, retryPolicy);
  }

  public Endpoint(String url, String apiKey) {
    this(url, apiKey, null);
  }

  public Endpoint(String url, String apiKey, RetryPolicy retryPolicy) {
    this.url = url;
    this.apiKey = apiKey;
    this.retryPolicy = retryPolicy;
  }

  public void setUrl(String url) {
    this.url = url;
  }

  public void setApiKey(String apiKey) {
    this.apiKey = apiKey;
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

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("Endpoint{");
    sb.append("url='").append(url).append('\'');
    sb.append(", apiKey='").append(apiKey).append('\'');
    sb.append(", retryPolicy=").append(retryPolicy);
    sb.append('}');
    return sb.toString();
  }
}
