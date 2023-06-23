package com.edgechain.service.prompts.schemas;

import com.fasterxml.jackson.annotation.JsonProperty;

public class JsonnetSchema {
  private String prompt;

  private int promptLength;

  @JsonProperty("type")
  private String typeString;

  public void setPrompt(String promptString) {
    this.prompt = promptString;
  }

  public void setType(String promptType) {
    this.typeString = promptType;
  }

  public void setPromptLength(int promptLength) {
    this.promptLength = promptLength;
  }

  public String getPrompt() {
    return this.prompt;
  }

  public String getType() {
    return this.typeString;
  }

  public int getPromptLength() {
    return this.promptLength;
  }
}
