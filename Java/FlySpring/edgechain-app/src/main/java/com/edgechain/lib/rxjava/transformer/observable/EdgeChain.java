package com.edgechain.lib.rxjava.transformer.observable;

import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.response.ArkResponse;
import com.edgechain.lib.response.ArkEmitter;
import com.edgechain.lib.response.ArkObservable;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import com.edgechain.lib.utils.RetryUtils;
import io.reactivex.rxjava3.annotations.NonNull;
import io.reactivex.rxjava3.core.*;
import io.reactivex.rxjava3.disposables.Disposable;
import io.reactivex.rxjava3.functions.*;
import io.reactivex.rxjava3.schedulers.Schedulers;

import java.io.Serializable;

public class EdgeChain<T> extends AbstractEdgeChain<T> implements Serializable {

  private static final long serialVersionUID = 297269864039510096L;

  private Endpoint endpoint;

  public EdgeChain(Observable<T> observable) {
    super(observable);
  }

  public EdgeChain(Observable<T> observable, Endpoint endpoint) {
    super(observable);
    this.endpoint = endpoint;
  }

  public EdgeChain(T item) {
    super(Observable.just(item));
  }

  @Override
  public <R> EdgeChain<R> transform(Function<T, R> mapper) {
    return new EdgeChain<>(this.observable.map(mapper));
  }

  @Override
  public <R> EdgeChain<R> combine(ObservableSource<T> other, BiFunction<T, T, R> zipper) {
    return new EdgeChain<>(this.observable.zipWith(other, zipper));
  }

  @Override
  public <R> EdgeChain<R> combine(EdgeChain<T> other, BiFunction<T, T, R> zipper) {
    return new EdgeChain<>(this.observable.zipWith(other.getObservable(), zipper));
  }

  @Override
  public EdgeChain<T> filter(Predicate<T> predicate) {
    return new EdgeChain<>(this.observable.filter(predicate));
  }

  @Override
  public EdgeChain<T> mergeWith(ObservableSource<T> other) {
    return new EdgeChain<>(this.observable.mergeWith(other));
  }

  @Override
  public EdgeChain<T> concatWith(ObservableSource<T> other) {
    return new EdgeChain<>(this.observable.concatWith(other));
  }

  @Override
  public EdgeChain<T> doOnComplete(Action onComplete) {
    return new EdgeChain<>(this.observable.doOnComplete(onComplete), endpoint);
  }

  @Override
  public EdgeChain<T> doOnNext(@NonNull Consumer<? super T> onNext) {
    return new EdgeChain<>(this.observable.doOnNext(onNext), endpoint);
  }

  @Override
  public EdgeChain<T> doOnEach(@NonNull Consumer<? super Notification<T>> onNotification) {
    return new EdgeChain<>(this.observable.doOnEach(onNotification), endpoint);
  }

  @Override
  public EdgeChain<T> doAfterNext(@NonNull Consumer<? super T> onAfterNext) {
    return new EdgeChain<>(this.observable.doAfterNext(onAfterNext), endpoint);
  }

  @Override
  public EdgeChain<T> doOnError(@NonNull Consumer<? super Throwable> onError) {
    return new EdgeChain<>(this.observable.doOnError(onError), endpoint);
  }

  @Override
  public EdgeChain<T> doOnSubscribe(Consumer<? super Disposable> onSubscribe) {
    return new EdgeChain<>(this.observable.doOnSubscribe(onSubscribe), endpoint);
  }

  @Override
  public EdgeChain<T> schedule() {
    return new EdgeChain<>(this.observable.subscribeOn(Schedulers.io()));
  }

  @Override
  public EdgeChain<T> schedule(Scheduler scheduler) {
    return new EdgeChain<>(this.observable.subscribeOn(scheduler));
  }

  @Override
  public EdgeChain<T> retry(
      Function<? super Observable<Throwable>, ? extends ObservableSource<?>> handler) {
    return new EdgeChain<>(this.observable.retryWhen(handler));
  }

  /**
   * Wrapper implementation of doWhile loop
   *
   * @param booleanSupplier
   * @return
   */
  @Override
  public EdgeChain<T> doWhileLoop(BooleanSupplier booleanSupplier) {
    return new EdgeChain<>(this.observable.repeatUntil(booleanSupplier));
  }

  @Override
  public void execute() {
    this.observable.subscribeOn(Schedulers.io()).subscribe();
  }

  @Override
  public void execute(RetryPolicy retryPolicy) {
    this.observable.subscribeOn(Schedulers.io()).retryWhen(retryPolicy).subscribe();
  }

  @Override
  public void execute(Consumer<? super T> onNext, Consumer<? super Throwable> onError) {
    this.observable.subscribeOn(Schedulers.io()).subscribe(onNext, onError);
  }

  @Override
  public void execute(
      Consumer<? super T> onNext, Consumer<? super Throwable> onError, RetryPolicy retryPolicy) {
    this.observable.subscribeOn(Schedulers.io()).retryWhen(retryPolicy).subscribe(onNext, onError);
  }

  @Override
  public void execute(
      Consumer<? super T> onNext, Consumer<? super Throwable> onError, Action onComplete) {
    this.observable.subscribeOn(Schedulers.io()).subscribe(onNext, onError, onComplete);
  }

  @Override
  public void execute(
      Consumer<? super T> onNext,
      Consumer<? super Throwable> onError,
      Action onComplete,
      RetryPolicy retryPolicy) {
    this.observable
        .subscribeOn(Schedulers.io())
        .retryWhen(retryPolicy)
        .subscribe(onNext, onError, onComplete);
  }

  @Override
  public Observable<T> getScheduledObservable() {

    if (RetryUtils.available(endpoint))
      return this.observable.retryWhen(endpoint.getRetryPolicy()).subscribeOn(Schedulers.io());
    else return this.observable.subscribeOn(Schedulers.io());
  }

  @Override
  public Single<T> toSingle() {

    if (RetryUtils.available(endpoint))
      return this.observable
          .subscribeOn(Schedulers.io())
          .retryWhen(endpoint.getRetryPolicy())
          .firstOrError();
    else return this.observable.subscribeOn(Schedulers.io()).firstOrError();
  }

  public Single<T> toSingleWithoutScheduler() {

    if (RetryUtils.available(endpoint))
      return this.observable.retryWhen(endpoint.getRetryPolicy()).firstOrError();
    else return this.observable.firstOrError();
  }

  @Override
  public T get() {
    if (RetryUtils.available(endpoint))
      return this.observable.retryWhen(endpoint.getRetryPolicy()).firstOrError().blockingGet();
    else return this.observable.firstOrError().blockingGet();
  }

  @Override
  public Observable<T> getObservable() {
    return this.observable;
  }

  @Override
  public Completable await() {

    if (RetryUtils.available(endpoint))
      return this.observable
          .subscribeOn(Schedulers.io())
          .retryWhen(endpoint.getRetryPolicy())
          .firstOrError()
          .ignoreElement();
    else return this.observable.subscribeOn(Schedulers.io()).firstOrError().ignoreElement();
  }

  @Override
  public void completed() {
    Completable.fromObservable(this.observable).subscribeOn(Schedulers.io()).subscribe();
  }

  @Override
  public void completed(Action onComplete) {
    Completable.fromObservable(this.observable).subscribeOn(Schedulers.io()).subscribe(onComplete);
  }

  @Override
  public void completed(Action onComplete, Consumer<? super Throwable> onError) {
    Completable.fromObservable(this.observable)
        .subscribeOn(Schedulers.io())
        .subscribe(onComplete, onError);
  }

  public ArkResponse getArkResponse() {
    return new ArkObservable<>(this.observable);
  }

  public ArkResponse getArkStreamResponse() {
    return new ArkEmitter<>(this.observable);
  }
}
