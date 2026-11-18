package com.edgechain.lib.openai.chains;

import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;

public class PluginChain extends EdgeChain<String> {

  public PluginChain(Observable<String> observable) {
    super(observable);
  }
}
