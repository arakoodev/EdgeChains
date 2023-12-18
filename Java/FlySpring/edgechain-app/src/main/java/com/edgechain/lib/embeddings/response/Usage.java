package com.edgechain.lib.embeddings.response;

import com.edgechain.lib.response.ArkObject;
import org.json.JSONObject;

public class Usage implements ArkObject {

  long prompt_tokens;
  long total_tokens;

  public long getPrompt_tokens() {
    return prompt_tokens;
  }

  public void setPrompt_tokens(long prompt_tokens) {
    this.prompt_tokens = prompt_tokens;
  }

  public long getTotal_tokens() {
    return total_tokens;
  }

  public void setTotal_tokens(long total_tokens) {
    this.total_tokens = total_tokens;
  }

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("Usage{");
    sb.append("prompt_tokens=").append(prompt_tokens);
    sb.append(", total_tokens=").append(total_tokens);
    sb.append('}');
    return sb.toString();
  }

  @Override
  public JSONObject toJson() {
    JSONObject json = new JSONObject();

    if (prompt_tokens != 0L) {
      json.put("prompt_tokens", prompt_tokens);
    }

    if (total_tokens != 0L) {
      json.put("total_tokens", total_tokens);
    }

    return json;
  }
}
