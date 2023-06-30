package com.edgechain.lib.request;

public class RedisRequest {

  private String input;
  private int topK;

  public RedisRequest() {}

  public RedisRequest(String input) {
    this.input = input;
  }

  public RedisRequest(String input, int topK) {
    this.input = input;
    this.topK = topK;
  }

  public int getTopK() {
    return topK;
  }

  public void setTopK(int topK) {
    this.topK = topK;
  }

  public String getInput() {
    return input;
  }

  public void setInput(String input) {
    this.input = input;
  }

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("RedisRequest{");
    sb.append("input='").append(input).append('\'');
    sb.append(", topK=").append(topK);
    sb.append('}');
    return sb.toString();
  }
}
