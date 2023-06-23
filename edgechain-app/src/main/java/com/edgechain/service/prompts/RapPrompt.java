package com.edgechain.service.prompts;

import com.edgechain.lib.openai.prompt.PromptTemplate;

public class RapPrompt implements PromptTemplate {
  @Override
  public String getPrompt() {
    return "Create an Eminem-like Rap for:";
  }
}
