package com.app.openai.chains;

import com.app.openai.endpoint.Endpoint;
import com.app.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;

public class IndexChain extends EdgeChain<String> {

  public IndexChain(Observable<String> observable) {
    super(observable);
  }

  public IndexChain(Observable<String> observable, Endpoint endpoint) {
    super(observable, endpoint);
  }
}
