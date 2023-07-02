package com.edgechain.lib.openai.chains;

import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;

public class IndexChain extends EdgeChain<StringResponse> {

  public IndexChain(Observable<StringResponse> observable) {
    super(observable);
  }

  public IndexChain(Observable<StringResponse> observable, Endpoint endpoint) {
    super(observable, endpoint);
  }
}
