package com.edgechain.lib.openai.request.feign;

import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;

import javax.validation.constraints.NotBlank;

public class OpenAiChatRequest {

  private OpenAiEndpoint endpoint;

  @NotBlank private String input;

  public OpenAiChatRequest(OpenAiEndpoint endpoint, String input) {
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

  public OpenAiEndpoint getEndpoint() {
    return endpoint;
  }

  public void setEndpoint(OpenAiEndpoint endpoint) {
    this.endpoint = endpoint;
  }
}
