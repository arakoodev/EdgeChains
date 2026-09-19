package com.edgechain.lib.response;

import io.reactivex.rxjava3.annotations.NonNull;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.observers.DisposableObserver;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyEmitter;

import java.io.IOException;

class ArkEmitterObserver<T> extends DisposableObserver<T> implements Runnable {

  private final ResponseBodyEmitter responseBodyEmitter;

  private boolean completed;

  public ArkEmitterObserver(Observable<T> observable, ResponseBodyEmitter responseBodyEmitter) {
    this.responseBodyEmitter = responseBodyEmitter;
    this.responseBodyEmitter.onTimeout(this);
    this.responseBodyEmitter.onCompletion(this);
    observable.subscribe(this);
  }

  @Override
  public void onNext(@NonNull T value) {

    try {
      if (!completed) {
        responseBodyEmitter.send(value);
      }
    } catch (IOException e) {
      throw new RuntimeException(e.getMessage(), e);
    }
  }

  @Override
  public void onError(@NonNull Throwable e) {
    responseBodyEmitter.completeWithError(e);
  }

  @Override
  public void onComplete() {

    if (!completed) {
      completed = true;
      responseBodyEmitter.complete();
    }
  }

  @Override
  public void run() {
    this.dispose();
  }
}
