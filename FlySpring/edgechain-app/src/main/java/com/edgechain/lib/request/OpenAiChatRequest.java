package com.edgechain.lib.request;

import com.edgechain.lib.openai.endpoint.Endpoint;

public class OpenAiChatRequest {

  private static final Integer MAX_TOKENS = 4097;
  private Endpoint endpoint;
  private String input;
  private int maxTokens = MAX_TOKENS;

  public OpenAiChatRequest(Endpoint endpoint, String input) {
    this.endpoint = endpoint;
    this.input = input;
  }

  public OpenAiChatRequest(Endpoint endpoint, String input, int maxTokens) {
    this.endpoint = endpoint;
    this.input = input;
    this.maxTokens = maxTokens;
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

  public int getMaxTokens() {
    return maxTokens;
  }

  public void setMaxTokens(int maxTokens) {
    this.maxTokens = maxTokens;
  }
}
