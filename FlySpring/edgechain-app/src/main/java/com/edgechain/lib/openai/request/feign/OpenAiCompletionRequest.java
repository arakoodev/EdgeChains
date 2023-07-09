package com.edgechain.lib.openai.request.feign;

import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;

public class OpenAiCompletionRequest {

  private OpenAiEndpoint endpoint;
  private String input;

  public OpenAiCompletionRequest(OpenAiEndpoint endpoint, String input) {
    this.endpoint = endpoint;
    this.input = input;
  }

  public OpenAiCompletionRequest() {}

  public String getInput() {
    return input;
  }

  public void setInput(String input) {
    this.input = input;
  }

  public OpenAiEndpoint getEndpoint() {
    return endpoint;
  }
}
