package com.edgechain.lib.embeddings.miniLLM.response;

import java.util.List;

public class MiniLMResponse {

  private List<Float> embedding;

  public MiniLMResponse() {}

  public MiniLMResponse(List<Float> embedding) {
    this.embedding = embedding;
  }

  public List<Float> getEmbedding() {
    return embedding;
  }

  public void setEmbedding(List<Float> embedding) {
    this.embedding = embedding;
  }
}
