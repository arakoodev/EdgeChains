package com.edgechain.lib.index.request.feign;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.Endpoint;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public class PineconeRequest {

  private Endpoint endpoint;
  private WordEmbeddings wordEmbeddings;
  private String namespace;


  private int topK;

  public PineconeRequest() {}

  public Endpoint getEndpoint() {
    return endpoint;
  }

  public void setEndpoint(Endpoint endpoint) {
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
