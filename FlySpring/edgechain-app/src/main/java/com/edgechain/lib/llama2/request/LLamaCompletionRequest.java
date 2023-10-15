package com.edgechain.lib.llama2.request;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.StringJoiner;

public class LLamaCompletionRequest {
  @JsonProperty("text_inputs")
  private String textInputs;

  @JsonProperty("return_full_text")
  private Boolean returnFullText;

  @JsonProperty("top_k")
  private Integer topK;

  public LLamaCompletionRequest() {}

  public LLamaCompletionRequest(String textInputs, Boolean returnFullText, Integer topK) {
    this.textInputs = textInputs;
    this.returnFullText = returnFullText;
    this.topK = topK;
  }

  @Override
  public String toString() {
    return new StringJoiner(", ", LLamaCompletionRequest.class.getSimpleName() + "{", "}")
        .add("\"text_inputs:\"" + textInputs)
        .add("\"return_full_text:\"" + returnFullText)
        .add("\"top_k:\"" + topK)
        .toString();
  }

  public static LlamaSupportChatCompletionRequestBuilder builder() {
    return new LlamaSupportChatCompletionRequestBuilder();
  }

  public String getTextInputs() {
    return textInputs;
  }

  public void setTextInputs(String textInputs) {
    this.textInputs = textInputs;
  }

  public Boolean getReturnFullText() {
    return returnFullText;
  }

  public void setReturnFullText(Boolean returnFullText) {
    this.returnFullText = returnFullText;
  }

  public Integer getTopK() {
    return topK;
  }

  public void setTopK(Integer topK) {
    this.topK = topK;
  }

  public static class LlamaSupportChatCompletionRequestBuilder {
    private String textInputs;
    private Boolean returnFullText;
    private Integer topK;

    private LlamaSupportChatCompletionRequestBuilder() {}

    public LlamaSupportChatCompletionRequestBuilder textInputs(String textInputs) {
      this.textInputs = textInputs;
      return this;
    }

    public LlamaSupportChatCompletionRequestBuilder returnFullText(Boolean returnFullText) {
      this.returnFullText = returnFullText;
      return this;
    }

    public LlamaSupportChatCompletionRequestBuilder topK(Integer topK) {
      this.topK = topK;
      return this;
    }

    public LLamaCompletionRequest build() {
      return new LLamaCompletionRequest(textInputs, returnFullText, topK);
    }
  }
}
