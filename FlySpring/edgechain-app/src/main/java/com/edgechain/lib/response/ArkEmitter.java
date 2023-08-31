package com.edgechain.lib.response;

import io.reactivex.rxjava3.core.Observable;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;

public class ArkEmitter<T> extends SseEmitter implements ArkResponse {
  private final ArkEmitterObserver<T> observer;

  public ArkEmitter(EdgeChain<T> edgeChain) {
    this(edgeChain.getScheduledObservable());
  }

  public ArkEmitter(Observable<T> observable) {
    this.observer = new ArkEmitterObserver<>(observable, this);
  }
}
