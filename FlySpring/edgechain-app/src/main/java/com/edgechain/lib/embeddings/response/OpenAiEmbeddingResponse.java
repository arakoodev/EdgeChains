package com.edgechain.lib.embeddings.response;

import java.util.List;

public class OpenAiEmbeddingResponse {

  private String model;
  private String object;
  private List<OpenAiEmbedding> data;
  private Usage usage;

  public String getModel() {
    return model;
  }

  public void setModel(String model) {
    this.model = model;
  }

  public String getObject() {
    return object;
  }

  public void setObject(String object) {
    this.object = object;
  }

  public List<OpenAiEmbedding> getData() {
    return data;
  }

  public void setData(List<OpenAiEmbedding> data) {
    this.data = data;
  }

  public Usage getUsage() {
    return usage;
  }

  public void setUsage(Usage usage) {
    this.usage = usage;
  }

  @Override
  public String toString() {
    return "OpenAiEmbeddingResponse{"
        + "model='"
        + model
        + '\''
        + ", object='"
        + object
        + '\''
        + ", data="
        + data
        + ", usage="
        + usage
        + '}';
  }
}
