package com.edgechain.lib.index.request.feign;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.PineconeEndpoint;

public class PineconeRequest {

  private PineconeEndpoint endpoint;
  private WordEmbeddings wordEmbeddings;
  private String namespace;

  private int topK;

  public PineconeRequest() {}

  public PineconeEndpoint getEndpoint() {
    return endpoint;
  }

  public void setEndpoint(PineconeEndpoint endpoint) {
    this.endpoint = endpoint;
  }

  public String getNamespace() {
    return namespace;
  }

  public void setNamespace(String namespace) {
    this.namespace = namespace;
  }

  public WordEmbeddings getWordEmbeddings() {
    return wordEmbeddings;
  }

  public void setWordEmbeddings(WordEmbeddings wordEmbeddings) {
    this.wordEmbeddings = wordEmbeddings;
  }

  public int getTopK() {
    return topK;
  }

  public void setTopK(int topK) {
    this.topK = topK;
  }
}
