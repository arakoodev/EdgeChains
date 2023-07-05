package com.edgechain.lib.wiki.request;

import com.edgechain.lib.endpoint.impl.WikiEndpoint;

public class WikiRequest {

  private WikiEndpoint endpoint;

  private String input;

  public WikiRequest() {}

  public WikiRequest(WikiEndpoint endpoint, String input) {
    this.endpoint = endpoint;
    this.input = input;
  }

  public WikiEndpoint getEndpoint() {
    return endpoint;
  }

  public void setEndpoint(WikiEndpoint endpoint) {
    this.endpoint = endpoint;
  }

  public String getInput() {
    return input;
  }

  public void setInput(String input) {
    this.input = input;
  }
}
