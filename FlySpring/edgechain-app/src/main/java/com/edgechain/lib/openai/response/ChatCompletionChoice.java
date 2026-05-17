package com.edgechain.lib.openai.response;

import com.edgechain.lib.openai.request.ChatMessage;
import com.edgechain.lib.response.ArkObject;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.json.JSONObject;

public class ChatCompletionChoice implements ArkObject {

  private Integer index;

  @JsonAlias("delta")
  private ChatMessage message;

  @JsonProperty("finish_reason")
  private String finishReason;

  public Integer getIndex() {
    return index;
  }

  public void setIndex(Integer index) {
    this.index = index;
  }

  public ChatMessage getMessage() {
    return message;
  }

  public void setMessage(ChatMessage message) {
    this.message = message;
  }

  public String getFinishReason() {
    return finishReason;
  }

  public void setFinishReason(String finishReason) {
    this.finishReason = finishReason;
  }

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("ChatCompletionChoice{");
    sb.append("index=").append(index);
    sb.append(", message=").append(message);
    sb.append(", finishReason='").append(finishReason).append('\'');
    sb.append('}');
    return sb.toString();
  }

  @Override
  public JSONObject toJson() {
    JSONObject json = new JSONObject();
    json.put("index", index);
    json.put("message", message.toJson());
    json.put("finish_reason", finishReason);
    return json;
  }
}
