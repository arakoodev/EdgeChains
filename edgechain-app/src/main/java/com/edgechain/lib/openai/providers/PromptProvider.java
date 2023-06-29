package com.edgechain.lib.openai.providers;

import com.edgechain.lib.openai.prompt.PromptTemplate;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;

public class PromptProvider extends ChainProvider {

  private final String prompt;
  private final int maxTokens;

  public PromptProvider(String prompt, int maxTokens) {
    this.prompt = prompt;
    this.maxTokens = maxTokens;
  }

  @Override
  public EdgeChain<ChainResponse> request(ChainRequest request) {

    return new EdgeChain<>(
        Observable.just(prompt + "\n" + request.getInput())
            .map(prompt -> prompt.length() > maxTokens ? prompt.substring(0, maxTokens) : prompt)
            .map(ChainResponse::new));
  }
}
