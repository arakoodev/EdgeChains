package com.edgechain.lib.openai.providers;

import com.edgechain.lib.openai.client.OpenAiClient;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.openai.request.CompletionRequest;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;

public class OpenAiCompletionProvider extends ChainProvider {
  private final Endpoint endpoint;

  public OpenAiCompletionProvider(Endpoint endpoint) {
    this.endpoint = endpoint;
  }

  @Override
  public EdgeChain<ChainResponse> request(ChainRequest request) { // Get Prompt

    CompletionRequest completionRequest =
        CompletionRequest.builder()
            .prompt(request.getInput())
            .model(endpoint.getModel())
            .temperature(endpoint.getTemperature())
            .maxTokens(2048)
            .build();

    return new OpenAiClient()
        .createCompletion(endpoint, completionRequest)
        .transform(ChainResponse::new);
  }
}
