package com.edgechain.service.prompts;

import com.edgechain.lib.openai.prompt.PromptTemplate;

public class WikiSummaryPrompt implements PromptTemplate {

  @Override
  public String getPrompt() {
    return "Create a 10-bullet point summary of: ";
  }
}
