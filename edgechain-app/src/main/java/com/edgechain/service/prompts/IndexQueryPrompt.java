package com.edgechain.service.prompts;

import com.edgechain.lib.openai.prompt.PromptTemplate;

public class IndexQueryPrompt implements PromptTemplate {

  @Override
  public String getPrompt() {

    return "Use the following pieces of context to answer the question at the end. If "
        + "you don't know the answer, just say that you don't know, don't try to make "
        + "up an answer.";
  }
}
