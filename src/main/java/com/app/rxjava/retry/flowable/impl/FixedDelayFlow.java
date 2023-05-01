package com.app.rxjava.retry.flowable.impl;

import com.app.rxjava.retry.flowable.RetryPolicyFlow;
import io.reactivex.rxjava3.core.Flowable;
import io.reactivex.rxjava3.functions.Function;
import org.reactivestreams.Publisher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.TimeUnit;

public class FixedDelayFlow extends RetryPolicyFlow {

    private final Logger logger = LoggerFactory.getLogger(this.getClass());

    private final int maxRetries;
    private final int retryDelay;
    private final TimeUnit unit;
    private int retryCount;

    public FixedDelayFlow(int maxRetries, int retryDelay, TimeUnit unit) {
        this.maxRetries = maxRetries;
        this.retryDelay = retryDelay;
        this.unit = unit;
        this.retryCount = 0;
    }

    @Override
    public Publisher<?> apply(Flowable<Throwable> throwableFlowable) throws Throwable {
        return throwableFlowable.flatMap((Function<Throwable, Publisher<?>>) throwable -> {
            if (++retryCount < maxRetries) {
                // Unsubscribe the original observable & resubscribed it.
                logger.info("Retrying it.... "+ throwable.getMessage());
                return Flowable.timer(unit.toMillis(retryDelay), TimeUnit.MILLISECONDS);
            }

            // Once, max-retries hit, emit an error.
            logger.error(throwable.getMessage());
            return Flowable.error(throwable);
        });
    }
}
