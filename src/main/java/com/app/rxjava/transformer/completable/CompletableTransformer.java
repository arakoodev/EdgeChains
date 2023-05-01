package com.app.rxjava.transformer.completable;

import com.app.rxjava.endpoint.EndpointFlow;
import com.app.rxjava.retry.flowable.impl.FixedDelayFlow;
import io.reactivex.rxjava3.core.*;
import io.reactivex.rxjava3.functions.*;
import io.reactivex.rxjava3.schedulers.Schedulers;

import java.util.Objects;
import java.util.concurrent.TimeUnit;

public class CompletableTransformer extends CompletableChain {

    private static final int MAX_RETRIES = 4;
    private static final int FIXED_DELAY = 3;
    private static final TimeUnit UNIT = TimeUnit.SECONDS;

    private EndpointFlow endpoint;

    public CompletableTransformer(Completable completable) {
        super(completable);
    }

    public CompletableTransformer(Completable completable, EndpointFlow endpoint) {
        super(completable);
        this.endpoint = endpoint;
    }

    @Override
    public CompletableChain mergeWith(CompletableSource other) {
        return new CompletableTransformer(this.completable.mergeWith(other));
    }

    @Override
    public CompletableChain mergeWith(CompletableChain other) {
        return new CompletableTransformer(this.completable.mergeWith(other.getCompletable()));
    }

    @Override
    public CompletableChain concatWith(CompletableSource other) {
        return new CompletableTransformer(this.completable.concatWith(other));
    }

    @Override
    public CompletableChain concatWith(CompletableChain other) {
        return new CompletableTransformer(this.completable.concatWith(other.getCompletable()));
    }

    @Override
    public CompletableChain schedule() {
        return new CompletableTransformer(this.completable.subscribeOn(Schedulers.io()));
    }

    @Override
    public CompletableChain schedule(Scheduler scheduler) {
        return new CompletableTransformer(this.completable.subscribeOn(scheduler));
    }


    /**
     * Wrapper implementation of doWhile loop
     * @param booleanSupplier
     * @return
     */
    @Override
    public CompletableChain doWhileLoop(BooleanSupplier booleanSupplier) {
        return new CompletableTransformer(this.completable.repeatUntil(booleanSupplier));
    }

    @Override
    public void execute() {
        this.completable
                .retryWhen(Objects.isNull(endpoint) ? new FixedDelayFlow(MAX_RETRIES,FIXED_DELAY,UNIT) : endpoint.getRetryPolicy())
                .subscribe();
    }


    @Override
    public void execute(Action onComplete) {
        this.completable
                .retryWhen(Objects.isNull(endpoint) ? new FixedDelayFlow(MAX_RETRIES,FIXED_DELAY,UNIT) : endpoint.getRetryPolicy())
                .subscribe(onComplete);
    }

    @Override
    public void execute(Action onComplete, Consumer<? super Throwable> onError) {
        this.completable
                .retryWhen(Objects.isNull(endpoint) ? new FixedDelayFlow(MAX_RETRIES,FIXED_DELAY,UNIT) : endpoint.getRetryPolicy())
                .subscribe(onComplete, onError);
    }

    @Override
    public void await() {
        this.completable
                .retryWhen(Objects.isNull(endpoint) ? new FixedDelayFlow(MAX_RETRIES,FIXED_DELAY,UNIT) : endpoint.getRetryPolicy())
                .blockingAwait();
    }


}
