package com.app.rxjava.transformer.observable;

import io.reactivex.rxjava3.annotations.NonNull;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.core.ObservableSource;
import io.reactivex.rxjava3.core.Scheduler;
import io.reactivex.rxjava3.functions.*;
import io.reactivex.rxjava3.schedulers.Schedulers;

public abstract class EdgeChain<T> {

    protected Observable<T> observable;

    public EdgeChain(Observable<T> observable) {
        this.observable = observable;
    }


    public abstract <R> EdgeChain<R> transform(Function<T,R> mapper);
    public abstract <R> EdgeChain<R> combine(ObservableSource<T> other, BiFunction<T, T, R> zipper);
    public abstract <R> EdgeChain<R> combine(EdgeChain<T> other, BiFunction<T, T, R> zipper);

    public abstract EdgeChain<T> filter(Predicate<T> predicate);
    public abstract EdgeChain<T> mergeWith(ObservableSource<T> other);
    public abstract EdgeChain<T> mergeWith(EdgeChain<T> other);
    public abstract EdgeChain<T> concatWith(ObservableSource<T> other);
    public abstract EdgeChain<T> concatWith(EdgeChain<T> other);

    public abstract EdgeChain<T> doOnNext(@NonNull Consumer<? super T> onNext);
    public abstract EdgeChain<T> doOnError(@NonNull Consumer<? super Throwable> onError);

    public abstract EdgeChain<T> schedule();
    public abstract EdgeChain<T> schedule(Scheduler scheduler);

    public abstract EdgeChain<T> doWhileLoop(BooleanSupplier booleanSupplier);

    public abstract void execute();
    public abstract void execute(Consumer<? super T> onNext, Consumer<? super Throwable> onError);
    public abstract void execute(Consumer<? super T> onNext, Consumer<? super Throwable> onError, Action onComplete);

    public abstract Observable<T> getRetryScheduledObservable();

    public abstract T get();

    /*
        Specialized Method where we assume API is returning errors like: (Not Returning JSON Response, Invalid URL)
        Primarily used with createCompletion() OPENAPI..
        Here, we by default assume the API will not emit an error, if correct API is provided
     */
    public abstract T getWithOutRetry();

    /* Primarily For Writing Test Cases & Transforming The Wrapper Into Observable */
    public Observable<T> getObservable() {
        return observable;
    }

    public Observable<T> getScheduledObservable() {
        return observable
                .subscribeOn(Schedulers.io());
    }




}
