package com.app.openai.llm.provider.impl;

import com.app.openai.client.OpenAiClient;
import com.app.openai.embeddings.openai.OpenAiEmbeddingRequest;
import com.app.openai.endpoint.Endpoint;
import com.app.openai.llm.provider.LLMProvider;
import com.app.rxjava.transformer.observable.EdgeChain;

import java.io.Serializable;

public class OpenAIEmbeddingProvider implements LLMProvider, Serializable {

  private static final long serialVersionUID = -6453404111107021938L;
  private final Endpoint endpoint;
  private final String model;

  public OpenAIEmbeddingProvider(Endpoint endpoint, String model) {
    this.endpoint = endpoint;
    this.model = model;
  }

  @Override
  public EdgeChain<String> request(String prompt) {
    return new OpenAiClient().createEmbeddings(endpoint, new OpenAiEmbeddingRequest(model, prompt));
  }
}
