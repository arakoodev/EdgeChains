package com.edgechain.lib.openai.request.feign;

import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;

public class OpenAiEmbeddingsRequest {

  private OpenAiEndpoint endpoint;
  private String input;

  public OpenAiEmbeddingsRequest() {}

  public OpenAiEmbeddingsRequest(OpenAiEndpoint endpoint, String input) {
    this.endpoint = endpoint;
    this.input = input;
  }

  public String getInput() {
    return input;
  }

  public void setInput(String input) {
    this.input = input;
  }

  public OpenAiEndpoint getEndpoint() {
    return endpoint;
  }

  public void setEndpoint(OpenAiEndpoint endpoint) {
    this.endpoint = endpoint;
  }

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("OpenAiEmbeddingsRequest{");
    sb.append("endpoint=").append(endpoint);
    sb.append(", input='").append(input).append('\'');
    sb.append('}');
    return sb.toString();
  }
}
