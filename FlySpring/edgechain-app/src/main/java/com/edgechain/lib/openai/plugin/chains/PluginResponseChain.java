package com.edgechain.lib.openai.plugin.chains;

import com.edgechain.lib.openai.plugin.response.PluginResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;

public class PluginResponseChain extends EdgeChain<PluginResponse> {

  public PluginResponseChain(Observable<PluginResponse> observable) {
    super(observable);
  }
}
