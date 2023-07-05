package com.edgechain.lib.rxjava.transformer.observable;

import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.response.ArkResponse;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import com.edgechain.lib.rxjava.retry.impl.FixedDelay;
import io.reactivex.rxjava3.annotations.NonNull;
import io.reactivex.rxjava3.core.*;
import io.reactivex.rxjava3.functions.*;
import io.reactivex.rxjava3.schedulers.Schedulers;
import reactor.util.retry.Retry;

import java.io.Serializable;
import java.util.Objects;
import java.util.concurrent.TimeUnit;

public class EdgeChain<T> extends AbstractEdgeChain<T> implements Serializable {

  private static final long serialVersionUID = 297269864039510096L;

  public EdgeChain(Observable<T> observable) {
    super(observable);
  }

  public static <T> EdgeChain<T> fromObservable(Observable<T> observable) {
    return new EdgeChain<>(observable);
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
  public <R> AbstractEdgeChain<R> combine(EdgeChain<T> other, BiFunction<T, T, R> zipper) {
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
  public AbstractEdgeChain<T> doOnComplete(Action onComplete) {
    return new EdgeChain<>(this.observable.doOnComplete(onComplete));
  }

  @Override
  public EdgeChain<T> doOnNext(@NonNull Consumer<? super T> onNext) {
    return new EdgeChain<>(this.observable.doOnNext(onNext));
  }

  @Override
  public EdgeChain<T> doOnError(@NonNull Consumer<? super Throwable> onError) {
    return new EdgeChain<>(this.observable.doOnError(onError));
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
    return this.observable.subscribeOn(Schedulers.io());
  }

  @Override
  public Observable<T> getScheduledObservable(RetryPolicy retryPolicy) {
    return this.observable.retryWhen(retryPolicy).subscribeOn(Schedulers.io());
  }

  @Override
  public Single<T> toSingle() {
    return this.observable.subscribeOn(Schedulers.io()).firstOrError();
  }

  @Override
  public Single<T> toSingle(RetryPolicy retryPolicy) {
    return this.observable.retryWhen(retryPolicy).subscribeOn(Schedulers.io()).firstOrError();
  }

  @Override
  public T get() {
    return this.observable.firstOrError().blockingGet();
  }

  @Override
  public T get(RetryPolicy retryPolicy) {
    return this.observable.retryWhen(retryPolicy).firstOrError().blockingGet();
  }

  @Override
  public Observable<T> getObservable() {
    return this.observable;
  }

  @Override
  public Completable await(RetryPolicy retryPolicy) {
    return this.observable
        .subscribeOn(Schedulers.io())
        .retryWhen(retryPolicy)
        .firstOrError()
        .ignoreElement();
  }

  @Override
  public Completable await() {
    return this.observable.subscribeOn(Schedulers.io()).firstOrError().ignoreElement();
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

  public ArkResponse<T> getArkResponse() {
    return new ArkResponse<>(this.observable.subscribeOn(Schedulers.io()));
  }
}
