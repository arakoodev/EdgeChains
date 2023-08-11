package com.edgechain.lib.embeddings.bgeSmall.response;

import java.util.List;

public class BgeSmallResponse {

  private List<Float> embedding;

  public BgeSmallResponse() {}

  public BgeSmallResponse(List<Float> embedding) {
    this.embedding = embedding;
  }

  public List<Float> getEmbedding() {
    return embedding;
  }

  public void setEmbedding(List<Float> embedding) {
    this.embedding = embedding;
  }
}
