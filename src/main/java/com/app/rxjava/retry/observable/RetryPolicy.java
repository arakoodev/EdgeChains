package com.app.rxjava.retry.observable;

import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.functions.Function;

public abstract class RetryPolicy implements Function<Observable<? extends Throwable>, Observable<?>> {
}
