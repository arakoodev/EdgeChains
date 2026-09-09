package com.edgechain.lib.wiki.response;

import com.edgechain.lib.response.ArkObject;
import org.json.JSONObject;

public class WikiResponse implements ArkObject {

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

  @Override
  public JSONObject toJson() {
    JSONObject json = new JSONObject();
    json.put("text", text);
    return json;
  }
}
