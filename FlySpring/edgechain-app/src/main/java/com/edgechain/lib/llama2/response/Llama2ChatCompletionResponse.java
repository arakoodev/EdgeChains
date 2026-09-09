package com.edgechain.lib.llama2.response;

import com.fasterxml.jackson.annotation.JsonProperty;

public class Llama2ChatCompletionResponse {
  @JsonProperty("generated_text")
  private String generatedText;

  public Llama2ChatCompletionResponse() {}

  public String getGeneratedText() {
    return generatedText;
  }

  public void setGeneratedText(String generatedText) {
    this.generatedText = generatedText;
  }
}
