package com.edgechain.lib.embeddings.response;

public class Usage {

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
}
