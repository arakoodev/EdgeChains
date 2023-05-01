package com.app.rxjava.transformer.completable;

import io.reactivex.rxjava3.core.*;
import io.reactivex.rxjava3.functions.*;
import io.reactivex.rxjava3.schedulers.Schedulers;

public abstract class CompletableChain {

    protected Completable completable;

    public CompletableChain(Completable completable) {
        this.completable = completable;
    }

    public abstract CompletableChain mergeWith(CompletableSource other);
    public abstract CompletableChain mergeWith(CompletableChain other);

    public abstract CompletableChain concatWith(CompletableSource other);
    public abstract CompletableChain concatWith(CompletableChain other);

    public abstract CompletableChain schedule();
    public abstract CompletableChain schedule(Scheduler scheduler);

    public abstract CompletableChain doWhileLoop(BooleanSupplier booleanSupplier);

    public abstract void execute();
    public abstract void execute(Action onComplete);
    public abstract void execute(Action onComplete, Consumer<? super Throwable> onError);

    public abstract void await();
    public Completable getCompletable() {
        return completable;
    }

    public Completable getScheduledCompletable() {
        return completable.subscribeOn(Schedulers.io());
    }


}
