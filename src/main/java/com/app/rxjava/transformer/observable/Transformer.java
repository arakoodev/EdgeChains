package com.app.rxjava.transformer.observable;

import com.app.rxjava.endpoint.Endpoint;
import com.app.rxjava.retry.observable.impl.FixedDelay;
import io.reactivex.rxjava3.annotations.NonNull;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.core.ObservableSource;
import io.reactivex.rxjava3.core.Scheduler;
import io.reactivex.rxjava3.functions.*;
import io.reactivex.rxjava3.schedulers.Schedulers;

import java.util.Objects;
import java.util.concurrent.TimeUnit;

public class Transformer<T> extends EdgeChain<T> {

    private static final int MAX_RETRIES = 4;
    private static final int FIXED_DELAY = 3;
    private static final TimeUnit UNIT = TimeUnit.SECONDS;

    private Endpoint endpoint;

    public Transformer(Observable<T> observable) {
        super(observable);
    }

    public Transformer(Observable<T> observable, Endpoint endpoint) {
        super(observable);
        this.endpoint = endpoint;
    }


    @Override
    public <R> EdgeChain<R> transform(Function<T, R> mapper) {
        return new Transformer<>(this.observable.map(mapper));
    }

    @Override
    public <R> EdgeChain<R> combine(ObservableSource<T> other, BiFunction<T, T, R> zipper) {
        return new Transformer<>(this.observable.zipWith(other,zipper));
    }

    @Override
    public <R> EdgeChain<R> combine(EdgeChain<T> other, BiFunction<T, T, R> zipper) {
        return new Transformer<>(this.observable.zipWith(other.getObservable(),zipper));
    }

    @Override
    public EdgeChain<T> filter(Predicate<T> predicate) {
        return new Transformer<>(this.observable.filter(predicate));
    }

    @Override
    public EdgeChain<T> mergeWith(ObservableSource<T> other) {
        return new Transformer<>(this.observable.mergeWith(other));
    }

    @Override
    public EdgeChain<T> mergeWith(EdgeChain<T> other) {
        return new Transformer<>(this.observable.mergeWith(other.getObservable()));
    }

    @Override
    public EdgeChain<T> concatWith(ObservableSource<T> other) {
        return new Transformer<>(this.observable.concatWith(other));
    }

    @Override
    public EdgeChain<T> concatWith(EdgeChain<T> other) {
        return new Transformer<>(this.observable.concatWith(other.getObservable()));
    }

    @Override
    public EdgeChain<T> doOnNext(@NonNull Consumer<? super T> onNext) {
        return new Transformer<>(this.observable.doOnNext(onNext));
    }

    @Override
    public EdgeChain<T> doOnError(@NonNull Consumer<? super Throwable> onError) {
        return new Transformer<>(this.observable.doOnError(onError));
    }

    @Override
    public EdgeChain<T> schedule() {
        return new Transformer<>(this.observable.subscribeOn(Schedulers.io()));
    }

    @Override
    public EdgeChain<T> schedule(Scheduler scheduler) {
        return new Transformer<>(this.observable.subscribeOn(scheduler));
    }


    /**
     * Wrapper implementation of doWhile loop
     * @param booleanSupplier
     * @return
     */
    @Override
    public EdgeChain<T> doWhileLoop(BooleanSupplier booleanSupplier) {
        return new Transformer<>(this.observable.repeatUntil(booleanSupplier));
    }

    @Override
    public void execute() {
        this.observable
                .subscribeOn(Schedulers.io())
                .retryWhen(Objects.isNull(endpoint) ? new FixedDelay(MAX_RETRIES,FIXED_DELAY,UNIT) : endpoint.getRetryPolicy())
                .subscribe();
    }


    @Override
    public void execute(Consumer<? super T> onNext, Consumer<? super Throwable> onError) {
        this.observable
                .subscribeOn(Schedulers.io())
                .retryWhen(Objects.isNull(endpoint) ? new FixedDelay(MAX_RETRIES,FIXED_DELAY,UNIT) : endpoint.getRetryPolicy())
                .subscribe(onNext, onError);
    }

    @Override
    public void execute(Consumer<? super T> onNext, Consumer<? super Throwable> onError, Action onComplete) {
        this.observable
                .subscribeOn(Schedulers.io())
                .retryWhen(Objects.isNull(endpoint) ? new FixedDelay(MAX_RETRIES, FIXED_DELAY, UNIT) : endpoint.getRetryPolicy())
                .subscribe(onNext, onError, onComplete);
    }

    @Override
    public Observable<T> getRetryScheduledObservable() {
        return this.observable
                .retryWhen(Objects.isNull(endpoint) ? new FixedDelay(MAX_RETRIES, FIXED_DELAY, UNIT) : endpoint.getRetryPolicy())
                .subscribeOn(Schedulers.io());
    }


    /**
     * Will Return Only Single Value In A Blocking Way (If emit successful the value is returned; otherwise error is emitted
     * @return
     */
    @Override
    public T get() {
        return this.observable
                .retryWhen(Objects.isNull(endpoint) ? new FixedDelay(MAX_RETRIES, FIXED_DELAY, UNIT) : endpoint.getRetryPolicy())
                .firstOrError().blockingGet();
    }

    @Override
    public T getWithOutRetry() {
        return this.observable.firstOrError().blockingGet();
    }


}
