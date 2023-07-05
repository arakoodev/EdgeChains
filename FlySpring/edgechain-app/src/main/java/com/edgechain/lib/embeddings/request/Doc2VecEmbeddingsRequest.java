package com.edgechain.lib.embeddings.request;

public class Doc2VecEmbeddingsRequest {

  private String input;

  public Doc2VecEmbeddingsRequest() {}

  public Doc2VecEmbeddingsRequest(String input) {
    this.input = input;
  }

  public String getInput() {
    return input;
  }

  public void setInput(String input) {
    this.input = input;
  }
}
