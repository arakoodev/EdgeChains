package com.edgechain.lib.rxjava.transformer.observable;

import com.edgechain.lib.rxjava.retry.RetryPolicy;
import io.reactivex.rxjava3.annotations.NonNull;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Notification;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.core.ObservableSource;
import io.reactivex.rxjava3.core.Scheduler;
import io.reactivex.rxjava3.core.Single;
import io.reactivex.rxjava3.disposables.Disposable;
import io.reactivex.rxjava3.functions.Action;
import io.reactivex.rxjava3.functions.BiFunction;
import io.reactivex.rxjava3.functions.BooleanSupplier;
import io.reactivex.rxjava3.functions.Consumer;
import io.reactivex.rxjava3.functions.Function;
import io.reactivex.rxjava3.functions.Predicate;
import java.io.Serializable;

public abstract class AbstractEdgeChain<T> implements Serializable {

  private static final long serialVersionUID = -7323653750095226732L;

  protected Observable<T> observable;

  protected AbstractEdgeChain(Observable<T> observable) {
    this.observable = observable;
  }

  public abstract <R> AbstractEdgeChain<R> transform(Function<T, R> mapper);

  public abstract <R> AbstractEdgeChain<R> combine(
      ObservableSource<T> other, BiFunction<T, T, R> zipper);

  public abstract <R> AbstractEdgeChain<R> combine(EdgeChain<T> other, BiFunction<T, T, R> zipper);

  public abstract AbstractEdgeChain<T> filter(Predicate<T> predicate);

  public abstract AbstractEdgeChain<T> mergeWith(ObservableSource<T> other);

  public abstract AbstractEdgeChain<T> concatWith(ObservableSource<T> other);

  // doOnEach, doOnSubscribe(), doOnComplete(),

  public abstract AbstractEdgeChain<T> doOnComplete(Action onComplete);

  public abstract AbstractEdgeChain<T> doOnNext(Consumer<? super T> onNext);

  public abstract AbstractEdgeChain<T> doOnEach(
      @NonNull Consumer<? super Notification<T>> onNotification);

  public abstract AbstractEdgeChain<T> doAfterNext(Consumer<? super T> onAfterNext);

  public abstract AbstractEdgeChain<T> doOnError(Consumer<? super Throwable> onError);

  public abstract AbstractEdgeChain<T> doOnSubscribe(Consumer<? super Disposable> onSubscribe);

  public abstract AbstractEdgeChain<T> schedule();

  public abstract AbstractEdgeChain<T> schedule(Scheduler scheduler);

  public abstract AbstractEdgeChain<T> retry(
      Function<? super Observable<Throwable>, ? extends ObservableSource<?>> handler);

  public abstract AbstractEdgeChain<T> doWhileLoop(BooleanSupplier booleanSupplier);

  public abstract void execute();

  public abstract void execute(RetryPolicy retryPolicy);

  public abstract void execute(Consumer<? super T> onNext, Consumer<? super Throwable> onError);

  public abstract void execute(
      Consumer<? super T> onNext, Consumer<? super Throwable> onError, RetryPolicy retryPolicy);

  public abstract void execute(
      Consumer<? super T> onNext,
      Consumer<? super Throwable> onError,
      Action onComplete,
      RetryPolicy retryPolicy);

  public abstract void execute(
      Consumer<? super T> onNext, Consumer<? super Throwable> onError, Action onComplete);

  public abstract Observable<T> getObservable();

  public abstract Observable<T> getScheduledObservable();

  public abstract Single<T> toSingle();

  public abstract T get();

  public abstract Completable await();

  public abstract void completed();

  public abstract void completed(Action onComplete);

  public abstract void completed(Action onComplete, Consumer<? super Throwable> onError);
}
