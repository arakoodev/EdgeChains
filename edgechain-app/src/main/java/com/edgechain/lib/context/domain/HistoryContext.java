package com.edgechain.lib.context.domain;

import java.io.Serializable;

public class HistoryContext implements Serializable {

  private static final long serialVersionUID = 2819947915596690671L;

  private String response;

  public String getResponse() {
    return response;
  }

  public void setResponse(String response) {
    this.response = response;
  }

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("HistoryContext{");
    sb.append("response='").append(response).append('\'');
    sb.append('}');
    return sb.toString();
  }

}
