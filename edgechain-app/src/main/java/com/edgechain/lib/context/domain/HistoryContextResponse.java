package com.edgechain.lib.context.domain;

public class HistoryContextResponse {

  private String id;
  private Integer maxTokens;

  private String message;

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public void setMaxTokens(Integer maxTokens) {
    this.maxTokens = maxTokens;
  }

  public String getMessage() {
    return message;
  }

  public void setMessage(String message) {
    this.message = message;
  }

  public int getMaxTokens() {
    return maxTokens;
  }

  public void setMaxTokens(int maxTokens) {
    this.maxTokens = maxTokens;
  }
}
