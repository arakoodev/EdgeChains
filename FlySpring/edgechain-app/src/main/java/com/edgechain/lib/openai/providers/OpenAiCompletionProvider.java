package com.edgechain.lib.openai.providers;

import com.edgechain.lib.endpoint.impl.llm.OpenAiChatEndpoint;
import com.edgechain.lib.openai.request.CompletionRequest;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;

/** Going to be removed * */
public class OpenAiCompletionProvider {
  private final OpenAiChatEndpoint endpoint;

  public OpenAiCompletionProvider(OpenAiChatEndpoint endpoint) {
    this.endpoint = endpoint;
  }

  public EdgeChain<StringResponse> request(String input) {

    CompletionRequest completionRequest =
        CompletionRequest.builder()
            .prompt(input)
            .model(endpoint.getModel())
            .temperature(endpoint.getTemperature())
            .build();

    return null;

    //
    //    return new OpenAiClient(endpoint)
    //        .createCompletion(completionRequest)
    //        .transform(s -> new StringResponse(s.getChoices().get(0).getText()));
  }
}
