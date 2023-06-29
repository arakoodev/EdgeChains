package com.edgechain.lib.rxjava.transformer.observable;

import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.response.ArkEmitter;
import com.edgechain.lib.response.ArkResponse;
import com.edgechain.lib.rxjava.retry.impl.FixedDelay;
import io.reactivex.rxjava3.annotations.NonNull;
import io.reactivex.rxjava3.core.*;
import io.reactivex.rxjava3.functions.*;
import io.reactivex.rxjava3.schedulers.Schedulers;

import java.io.Serializable;
import java.util.Objects;
import java.util.concurrent.TimeUnit;

public class EdgeChain<T> extends AbstractEdgeChain<T> implements Serializable {

  private static final long serialVersionUID = 297269864039510096L;

  private static final int MAX_RETRIES = 3;
  private static final int FIXED_DELAY = 10;
  private static final TimeUnit UNIT = TimeUnit.SECONDS;

  private Endpoint endpoint;

  public EdgeChain(Observable<T> observable) {
    super(observable);
  }

  public EdgeChain(Observable<T> observable, Endpoint endpoint) {
    super(observable);
    this.endpoint = endpoint;
  }

  @Override
  public <R> EdgeChain<R> transform(Function<T, R> mapper) {
    return new EdgeChain<>(this.observable.map(mapper), endpoint);
  }

  public static <T> EdgeChain<T> create(T t) {
    return new EdgeChain<>(Observable.just(t));
  }

  @Override
  public <R> EdgeChain<R> combine(ObservableSource<T> other, BiFunction<T, T, R> zipper) {
    return new EdgeChain<>(this.observable.zipWith(other, zipper), endpoint);
  }

  @Override
  public <R> AbstractEdgeChain<R> combine(EdgeChain<T> other, BiFunction<T, T, R> zipper) {
    return new EdgeChain<>(this.observable.zipWith(other.getObservable(), zipper), endpoint);
  }

  @Override
  public EdgeChain<T> filter(Predicate<T> predicate) {
    return new EdgeChain<>(this.observable.filter(predicate), endpoint);
  }

  @Override
  public EdgeChain<T> mergeWith(ObservableSource<T> other) {
    return new EdgeChain<>(this.observable.mergeWith(other), endpoint);
  }

  @Override
  public EdgeChain<T> concatWith(ObservableSource<T> other) {
    return new EdgeChain<>(this.observable.concatWith(other), endpoint);
  }

  @Override
  public AbstractEdgeChain<T> doOnComplete(Action onComplete) {
    return new EdgeChain<>(this.observable.doOnComplete(onComplete), endpoint);
  }

  @Override
  public EdgeChain<T> doOnNext(@NonNull Consumer<? super T> onNext) {
    return new EdgeChain<>(this.observable.doOnNext(onNext), endpoint);
  }

  @Override
  public EdgeChain<T> doOnError(@NonNull Consumer<? super Throwable> onError) {
    return new EdgeChain<>(this.observable.doOnError(onError), endpoint);
  }

  @Override
  public EdgeChain<T> schedule() {
    return new EdgeChain<>(this.observable.subscribeOn(Schedulers.io()), endpoint);
  }

  @Override
  public EdgeChain<T> schedule(Scheduler scheduler) {
    return new EdgeChain<>(this.observable.subscribeOn(scheduler), endpoint);
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
    return new EdgeChain<>(this.observable.repeatUntil(booleanSupplier), endpoint);
  }

  @Override
  public void execute() {
    this.observable
        .subscribeOn(Schedulers.io())
        .retryWhen(
            Objects.isNull(endpoint)
                ? new FixedDelay(MAX_RETRIES, FIXED_DELAY, UNIT)
                : endpoint.getRetryPolicy())
        .subscribe();
  }

  @Override
  public void execute(Consumer<? super T> onNext, Consumer<? super Throwable> onError) {
    this.observable
        .subscribeOn(Schedulers.io())
        .retryWhen(
            Objects.isNull(endpoint)
                ? new FixedDelay(MAX_RETRIES, FIXED_DELAY, UNIT)
                : endpoint.getRetryPolicy())
        .subscribe(onNext, onError);
  }

  @Override
  public void execute(
      Consumer<? super T> onNext, Consumer<? super Throwable> onError, Action onComplete) {
    this.observable
        .subscribeOn(Schedulers.io())
        .retryWhen(
            Objects.isNull(endpoint)
                ? new FixedDelay(MAX_RETRIES, FIXED_DELAY, UNIT)
                : endpoint.getRetryPolicy())
        .subscribe(onNext, onError, onComplete);
  }

  @Override
  public Observable<T> getScheduledObservableWithRetry() {
    return this.observable
        .retryWhen(
            Objects.isNull(endpoint)
                ? new FixedDelay(MAX_RETRIES, FIXED_DELAY, UNIT)
                : endpoint.getRetryPolicy())
        .subscribeOn(Schedulers.io());
  }

  @Override
  public Single<T> toSingleWithRetry() {
    return this.observable
        .retryWhen(
            Objects.isNull(endpoint)
                ? new FixedDelay(MAX_RETRIES, FIXED_DELAY, UNIT)
                : endpoint.getRetryPolicy())
        .subscribeOn(Schedulers.io())
        .firstOrError();
  }

  @Override
  public Single<T> toSingleWithOutRetry() {
    return this.observable.subscribeOn(Schedulers.io()).firstOrError();
  }

  @Override
  public Observable<T> getScheduledObservableWithoutRetry() {
    return this.observable.subscribeOn(Schedulers.io());
  }

  @Override
  public T getWithRetry(Scheduler scheduler) {
    return this.observable
        .subscribeOn(scheduler)
        .retryWhen(
            Objects.isNull(endpoint)
                ? new FixedDelay(MAX_RETRIES, FIXED_DELAY, UNIT)
                : endpoint.getRetryPolicy())
        .firstOrError()
        .blockingGet();
  }

  @Override
  public T getWithRetry() {
    return this.observable
        .retryWhen(
            Objects.isNull(endpoint)
                ? new FixedDelay(MAX_RETRIES, FIXED_DELAY, UNIT)
                : endpoint.getRetryPolicy())
        .firstOrError()
        .blockingGet();
  }

  @Override
  public T getWithOutRetry() {
    return this.observable.firstOrError().blockingGet();
  }

  @Override
  public Observable<T> getObservable() {
    return this.observable;
  }

  public ArkResponse<T> getArkResponse(){
    return new ArkResponse<T>(this.getScheduledObservableWithoutRetry());
  }

  public ArkEmitter<T> getArkEmitter(){
    return new ArkEmitter<>(this.getScheduledObservableWithoutRetry());
  }

  @Override
  public void awaitWithRetry() {
    Completable.fromObservable(
            this.observable.retryWhen(
                Objects.isNull(endpoint)
                    ? new FixedDelay(MAX_RETRIES, FIXED_DELAY, UNIT)
                    : endpoint.getRetryPolicy()))
        .blockingAwait();
  }

  @Override
  public void awaitWithoutRetry() {
    Completable.fromObservable(this.observable).blockingAwait();
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
}
