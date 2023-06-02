package com.edgechain.lib.openai.providers;

import com.edgechain.lib.openai.client.OpenAiClient;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.openai.request.ChatCompletionRequest;
import com.edgechain.lib.openai.request.ChatMessage;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;

public class OpenAiChatCompletionProvider extends ChainProvider {

  private final Endpoint endpoint;

  public OpenAiChatCompletionProvider(Endpoint endpoint) {
    this.endpoint = endpoint;
  }

  @Override
  public EdgeChain<ChainResponse> request(ChainRequest request) {

    ChatCompletionRequest chatCompletionRequest =
        ChatCompletionRequest.builder()
            .model(endpoint.getModel())
            .temperature(endpoint.getTemperature())
            .messages(List.of(new ChatMessage(endpoint.getRole(), request.getInput())))
            .build();

    return new OpenAiClient()
        .createChatCompletion(endpoint, chatCompletionRequest)
        .transform(s -> new ChainResponse(this.parse(s)));
  }

  private String parse(String body) throws JsonProcessingException {
    JsonNode outputJsonNode = new ObjectMapper().readTree(body);
    System.out.println("Pretty String: " + outputJsonNode.toPrettyString());

    return outputJsonNode.get("choices").get(0).get("message").get("content").asText();
  }
}
