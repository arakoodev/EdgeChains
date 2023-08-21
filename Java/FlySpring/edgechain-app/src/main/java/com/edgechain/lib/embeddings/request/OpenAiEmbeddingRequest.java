package com.edgechain.lib.embeddings.request;

public class OpenAiEmbeddingRequest {
  private String input;
  private String model;

  public OpenAiEmbeddingRequest(String model, String input) {
    this.model = model;
    this.input = input;
  }

  public String getModel() {
    return model;
  }

  public void setModel(String model) {
    this.model = model;
  }

  public String getInput() {
    return input;
  }

  public void setInput(String input) {
    this.input = input;
  }

  @Override
  public String toString() {
    return "OpenAiEmbeddingRequest{" + "model='" + model + '\'' + ", input='" + input + '\'' + '}';
  }
}
