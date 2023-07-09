package com.edgechain.lib.wiki.response;

public class WikiResponse {

  private String text;

  public WikiResponse() {}

  public WikiResponse(String text) {
    this.text = text;
  }

  public String getText() {
    return text;
  }

  public void setText(String text) {
    this.text = text;
  }

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("WikiResponse{");
    sb.append("text='").append(text).append('\'');
    sb.append('}');
    return sb.toString();
  }
}
