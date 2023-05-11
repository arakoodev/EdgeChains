package com.app.openaiwiki.chains;

import com.app.openai.endpoint.Endpoint;
import com.app.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;

public class KlarnaChain extends EdgeChain<String> {

  public KlarnaChain(Observable<String> observable) {
    super(observable);
  }

  public KlarnaChain(Observable<String> observable, Endpoint endpoint) {
    super(observable, endpoint);
  }
}
