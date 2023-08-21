package com.edgechain.lib.response;

import io.reactivex.rxjava3.annotations.NonNull;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.observers.DisposableObserver;
import org.springframework.web.context.request.async.DeferredResult;

public class ArkObserver<T> extends DisposableObserver<T> implements Runnable {

  private final DeferredResult<T> deferredResult;

  public ArkObserver(Observable<T> observable, DeferredResult<T> deferredResult) {
    this.deferredResult = deferredResult;
    this.deferredResult.onTimeout(this);
    this.deferredResult.onCompletion(this);
    observable.subscribe(this);
  }

  @Override
  public void onNext(@NonNull T value) {
    deferredResult.setResult(value);
  }

  @Override
  public void onError(@NonNull Throwable e) {
    deferredResult.setErrorResult(e);
  }

  @Override
  public void onComplete() {}

  @Override
  public void run() {
    this.dispose();
  }
}
