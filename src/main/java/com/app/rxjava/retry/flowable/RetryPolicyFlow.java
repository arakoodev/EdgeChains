package com.app.rxjava.retry.flowable;

import io.reactivex.rxjava3.core.Flowable;
import io.reactivex.rxjava3.functions.Function;
import org.reactivestreams.Publisher;

public abstract class RetryPolicyFlow implements Function<Flowable<Throwable>, Publisher<?>> {
}
