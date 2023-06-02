package com.edgechain.service.request;

import com.edgechain.lib.openai.endpoint.Endpoint;

public class OpenAiChatRequest {

  private Endpoint endpoint;
  private String input;

  public OpenAiChatRequest(Endpoint endpoint, String input) {
    this.endpoint = endpoint;
    this.input = input;
  }

  public OpenAiChatRequest() {}

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
