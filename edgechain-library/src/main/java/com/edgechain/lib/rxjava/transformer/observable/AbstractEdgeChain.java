package com.edgechain.lib.rxjava.transformer.observable;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.core.ObservableSource;
import io.reactivex.rxjava3.core.Scheduler;
import io.reactivex.rxjava3.core.Single;
import io.reactivex.rxjava3.functions.*;

import java.io.Serializable;


public abstract class AbstractEdgeChain<T> implements Serializable {

    private static final long serialVersionUID = -7323653750095226732L;

    protected Observable<T> observable;


    public AbstractEdgeChain(Observable<T> observable) {
        this.observable = observable;
    }


    public abstract <R> AbstractEdgeChain<R> transform(Function<T,R> mapper);
    public abstract <R> AbstractEdgeChain<R> combine(ObservableSource<T> other, BiFunction<T, T, R> zipper);
    public abstract <R> AbstractEdgeChain<R> combine(EdgeChain<T> other, BiFunction<T, T, R> zipper);
    public abstract AbstractEdgeChain<T> filter(Predicate<T> predicate);
    public abstract AbstractEdgeChain<T> mergeWith(ObservableSource<T> other);
    public abstract AbstractEdgeChain<T> concatWith(ObservableSource<T> other);

    public abstract AbstractEdgeChain<T> doOnComplete(Action onComplete);
    public abstract AbstractEdgeChain<T> doOnNext(Consumer<? super T> onNext);
    public abstract AbstractEdgeChain<T> doOnError(Consumer<? super Throwable> onError);

    public abstract AbstractEdgeChain<T> schedule();
    public abstract AbstractEdgeChain<T> schedule(Scheduler scheduler);

    public abstract AbstractEdgeChain<T> retry(Function<? super Observable<Throwable>, ? extends ObservableSource<?>> handler);
    public abstract AbstractEdgeChain<T> doWhileLoop(BooleanSupplier booleanSupplier);

    public abstract void execute();
    public abstract void execute(Consumer<? super T> onNext, Consumer<? super Throwable> onError);
    public abstract void execute(Consumer<? super T> onNext, Consumer<? super Throwable> onError, Action onComplete);

    public abstract Observable<T> getObservable();

    public abstract Observable<T> getScheduledObservableWithRetry();
    public abstract Observable<T> getScheduledObservableWithoutRetry();

    public abstract Single<T> toSingleWithRetry();
    public abstract Single<T> toSingleWithOutRetry();

    public abstract T getWithRetry(Scheduler scheduler);
    public abstract T getWithRetry();

    public abstract T getWithOutRetry();


    /* For completable implementation */
    public abstract void awaitWithRetry();
    public abstract void awaitWithoutRetry();

    public abstract void completed();
    public abstract void completed(Action onComplete);
    public abstract void completed(Action onComplete, Consumer<? super Throwable> onError);



}
