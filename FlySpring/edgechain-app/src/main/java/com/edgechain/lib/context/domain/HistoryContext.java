package com.edgechain.lib.context.domain;

import java.io.Serializable;

public class HistoryContext implements Serializable {

  private static final long serialVersionUID = 2819947915596690671L;

  private String id;
  private String response;

  public HistoryContext() {}

  public HistoryContext(String id, String response) {
    this.id = id;
    this.response = response;
  }

  public String getResponse() {
    return response;
  }

  public void setResponse(String response) {
    this.response = response;
  }

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("HistoryContext{");
    sb.append("id='").append(id).append('\'');
    sb.append(", response='").append(response).append('\'');
    sb.append('}');
    return sb.toString();
  }
}
