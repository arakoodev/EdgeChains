package com.edgechain.lib.request;

import com.edgechain.lib.openai.endpoint.Endpoint;

public class OpenAiCompletionRequest {

  private Endpoint endpoint;
  private String input;

  public OpenAiCompletionRequest(Endpoint endpoint, String input) {
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

  public Endpoint getEndpoint() {
    return endpoint;
  }

  public void setEndpoint(Endpoint endpoint) {
    this.endpoint = endpoint;
  }
}
