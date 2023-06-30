package com.edgechain.lib.request;

import com.edgechain.lib.openai.endpoint.Endpoint;

import java.util.List;

public class PineconeRequest {

  private Endpoint endpoint;
  private String input;
  private List<String> vectorIds;
  private int topK;
  private String namespace = "";

  public PineconeRequest() {}

  public PineconeRequest(Endpoint endpoint) {
    this.endpoint = endpoint;
  }

  public PineconeRequest(Endpoint endpoint, List<String> vectorIds) {
    this.endpoint = endpoint;
    this.vectorIds = vectorIds;
  }

  public PineconeRequest(Endpoint endpoint, String input) {
    this.endpoint = endpoint;
    this.input = input;
  }

  public PineconeRequest(Endpoint endpoint, String input, int topK) {
    this.endpoint = endpoint;
    this.input = input;
    this.topK = topK;
  }

  public PineconeRequest(Endpoint endpoint, String input, int topK, String namespace) {
    this.endpoint = endpoint;
    this.input = input;
    this.topK = topK;
    this.namespace = namespace;
  }

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

  public List<String> getVectorIds() {
    return vectorIds;
  }

  public void setVectorIds(List<String> vectorIds) {
    this.vectorIds = vectorIds;
  }

  public void setTopK(int topK) {
    this.topK = topK;
  }

  public String getNamespace() {
    return namespace;
  }

  public void setNamespace(String namespace) {
    this.namespace = namespace;
  }

  public int getTopK() {
    return topK;
  }
}
