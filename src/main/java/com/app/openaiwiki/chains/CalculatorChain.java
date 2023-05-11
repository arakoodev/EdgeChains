package com.app.openaiwiki.chains;

import com.app.openai.endpoint.Endpoint;
import com.app.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;

public class CalculatorChain extends EdgeChain<String> {
  public CalculatorChain(Observable<String> observable) {
    super(observable);
  }

  public CalculatorChain(Observable<String> observable, Endpoint endpoint) {
    super(observable, endpoint);
  }
}
