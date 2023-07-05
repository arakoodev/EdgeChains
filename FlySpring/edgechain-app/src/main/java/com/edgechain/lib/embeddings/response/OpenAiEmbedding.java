package com.edgechain.lib.embeddings.response;

import java.util.List;

public class OpenAiEmbedding {

  private String object;
  private List<Float> embedding;
  private Integer index;

  public String getObject() {
    return object;
  }

  public void setObject(String object) {
    this.object = object;
  }

  public List<Float> getEmbedding() {
    return embedding;
  }

  public void setEmbedding(List<Float> embedding) {
    this.embedding = embedding;
  }

  public Integer getIndex() {
    return index;
  }

  public void setIndex(Integer index) {
    this.index = index;
  }

  @Override
  public String toString() {
    return "OpenAiEmbedding{"
        + "object='"
        + object
        + '\''
        + ", embedding="
        + embedding
        + ", index="
        + index
        + '}';
  }
}
