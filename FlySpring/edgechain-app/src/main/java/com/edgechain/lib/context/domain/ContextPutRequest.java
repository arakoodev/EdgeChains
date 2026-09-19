package com.edgechain.lib.context.domain;

public class ContextPutRequest<T> {

  private String id;
  private String response;
  private T endpoint;

  public ContextPutRequest() {}

  public ContextPutRequest(String id, String response, T endpoint) {
    this.id = id;
    this.response = response;
    this.endpoint = endpoint;
  }

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public String getResponse() {
    return response;
  }

  public void setResponse(String response) {
    this.response = response;
  }

  public T getEndpoint() {
    return endpoint;
  }
}
