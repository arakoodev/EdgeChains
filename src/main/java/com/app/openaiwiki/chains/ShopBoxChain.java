package com.app.openaiwiki.chains;

import com.app.openai.endpoint.Endpoint;
import com.app.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;

public class ShopBoxChain extends EdgeChain<String> {

  public ShopBoxChain(Observable<String> observable) {
    super(observable);
  }

  public ShopBoxChain(Observable<String> observable, Endpoint endpoint) {
    super(observable, endpoint);
  }
}
