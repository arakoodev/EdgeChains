package com.edgechain.lib.openai.providers;

import com.edgechain.lib.openai.client.OpenAiClient;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.openai.request.CompletionRequest;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;

public class OpenAiCompletionProvider {
  private final Endpoint endpoint;

  public OpenAiCompletionProvider(Endpoint endpoint) {
    this.endpoint = endpoint;
  }

  public EdgeChain<StringResponse> request(String input) {

    CompletionRequest completionRequest =
        CompletionRequest.builder()
            .prompt(input)
            .model(endpoint.getModel())
            .temperature(endpoint.getTemperature())
            .build();

    return new OpenAiClient()
        .createCompletion(endpoint, completionRequest)
        .transform(s -> new StringResponse(s.getChoices().get(0).getText()));
  }
}
