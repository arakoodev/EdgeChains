package com.edgechain.lib.response;

import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.web.context.request.async.DeferredResult;

public class ArkObservable<T> extends DeferredResult<T> implements ArkResponse {

  private final ArkObserver<T> observer;

  public ArkObservable(EdgeChain<T> edgeChain) {
    observer = new ArkObserver<>(edgeChain.getObservable(), this);
  }

  public ArkObservable(Observable<T> observable) {
    observer = new ArkObserver<>(observable, this);
  }
}
