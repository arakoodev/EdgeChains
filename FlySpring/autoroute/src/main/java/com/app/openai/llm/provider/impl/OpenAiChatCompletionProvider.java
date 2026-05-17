package com.app.openai.llm.provider.impl;

import com.app.openai.client.OpenAiClient;
import com.app.openai.endpoint.Endpoint;
import com.app.openai.llm.provider.LLMProvider;
import com.app.openai.request.ChatCompletionRequest;
import com.app.openai.request.ChatMessage;
import com.app.rxjava.transformer.observable.EdgeChain;

import java.util.List;

public class OpenAiChatCompletionProvider implements LLMProvider {
  private final Endpoint endpoint;

  public OpenAiChatCompletionProvider(Endpoint endpoint) {
    this.endpoint = endpoint;
  }

  public EdgeChain<String> request(String prompt) {
    ChatCompletionRequest request =
        ChatCompletionRequest.builder()
            .model(endpoint.getModel())
            .temperature(endpoint.getTemperature())
            .messages(List.of(new ChatMessage(endpoint.getRole(), prompt)))
            .build();
    return (new OpenAiClient()).createChatCompletion(endpoint, request);
  }
}
