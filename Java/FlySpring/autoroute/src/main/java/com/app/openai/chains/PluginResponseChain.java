package com.app.openai.chains;

import com.app.openai.endpoint.Endpoint;
import com.app.openai.plugin.response.PluginResponse;
import com.app.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;

public class PluginResponseChain extends EdgeChain<PluginResponse> {

  public PluginResponseChain(Observable<PluginResponse> observable) {
    super(observable);
  }

  public PluginResponseChain(Observable<PluginResponse> observable, Endpoint endpoint) {
    super(observable, endpoint);
  }
}
