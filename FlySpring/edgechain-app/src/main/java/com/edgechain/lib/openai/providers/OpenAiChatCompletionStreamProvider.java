package com.edgechain.lib.openai.providers;

import com.edgechain.lib.openai.client.OpenAiClient;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.openai.request.ChatCompletionRequest;
import com.edgechain.lib.openai.request.ChatMessage;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;

import java.util.List;

public class OpenAiChatCompletionStreamProvider extends ChainProvider {

  private final Endpoint endpoint;

  public OpenAiChatCompletionStreamProvider(Endpoint endpoint) {
    this.endpoint = endpoint;
  }

  @Override
  public EdgeChain<ChainResponse> request(ChainRequest request) {

    ChatCompletionRequest chatCompletionRequest =
        ChatCompletionRequest.builder()
            .model(endpoint.getModel())
            .temperature(endpoint.getTemperature())
            .messages(List.of(new ChatMessage(endpoint.getRole(), request.getInput())))
            .stream(true)
            .build();

    return new OpenAiClient()
        .createChatCompletionStream(endpoint, chatCompletionRequest)
        .transform(s -> new ChainResponse(s.getChoices().get(0).getMessage().getContent()));
  }
}
