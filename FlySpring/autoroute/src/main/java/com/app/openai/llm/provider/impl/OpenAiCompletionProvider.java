package com.app.openai.llm.provider.impl;

import com.app.openai.client.OpenAiClient;
import com.app.openai.endpoint.Endpoint;
import com.app.openai.llm.provider.LLMProvider;
import com.app.openai.request.CompletionRequest;
import com.app.rxjava.transformer.observable.EdgeChain;

public class OpenAiCompletionProvider implements LLMProvider {

  private final Endpoint endpoint;
  private final String model;
  private final Double temperature;
  private final Integer max_tokens;

  public OpenAiCompletionProvider(
      Endpoint endpoint, String model, Double temperature, Integer max_tokens) {
    this.endpoint = endpoint;
    this.model = model;
    this.temperature = temperature;
    this.max_tokens = max_tokens;
  }

  @Override
  public EdgeChain<String> request(String prompt) {

    CompletionRequest completionRequest =
        CompletionRequest.builder()
            .prompt(prompt)
            .model(this.model)
            .temperature(this.temperature)
            .maxTokens(this.max_tokens)
            .build();

    return new OpenAiClient().createCompletion(endpoint, completionRequest);
  }
}
