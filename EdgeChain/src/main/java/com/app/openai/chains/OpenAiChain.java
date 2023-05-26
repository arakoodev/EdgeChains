package com.app.openai.chains;

import com.app.openai.endpoint.Endpoint;
import com.app.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;

public class OpenAiChain extends EdgeChain<String> {

  public OpenAiChain(Observable<String> observable) {
    super(observable);
  }

  public OpenAiChain(Observable<String> observable, Endpoint endpoint) {
    super(observable, endpoint);
  }
}
