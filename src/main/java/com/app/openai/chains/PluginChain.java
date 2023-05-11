package com.app.openai.chains;

import com.app.openai.endpoint.Endpoint;
import com.app.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;

public class PluginChain extends EdgeChain<String> {

  public PluginChain(Observable<String> observable) {
    super(observable);
  }

  public PluginChain(Observable<String> observable, Endpoint endpoint) {
    super(observable, endpoint);
  }
}
