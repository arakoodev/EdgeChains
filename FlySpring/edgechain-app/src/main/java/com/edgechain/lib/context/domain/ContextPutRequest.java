package com.edgechain.lib.context.domain;

import com.edgechain.lib.endpoint.Endpoint;

public class ContextPutRequest {

  private String id;
  private String response;
  private Endpoint endpoint;

  public ContextPutRequest() {}

  public ContextPutRequest(String id, String response, Endpoint endpoint) {
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

  public Endpoint getEndpoint() {
    return endpoint;
  }

  public void setEndpoint(Endpoint endpoint) {
    this.endpoint = endpoint;
  }
}
