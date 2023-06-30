package com.edgechain.lib.context.domain;

import javax.validation.constraints.Min;

public class HistoryContextRequest {

  @Min(value = 512)
  private Integer maxTokens;

  public int getMaxTokens() {
    return maxTokens;
  }

  public void setMaxTokens(int maxTokens) {
    this.maxTokens = maxTokens;
  }

  public void setMaxTokens(Integer maxTokens) {
    this.maxTokens = maxTokens;
  }
}
