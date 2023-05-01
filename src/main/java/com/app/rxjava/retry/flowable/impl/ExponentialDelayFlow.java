package com.app.rxjava.retry.flowable.impl;

import com.app.rxjava.retry.flowable.RetryPolicyFlow;
import io.reactivex.rxjava3.core.Flowable;
import io.reactivex.rxjava3.functions.Function;
import org.reactivestreams.Publisher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.TimeUnit;

public class ExponentialDelayFlow extends RetryPolicyFlow {

    private final Logger logger = LoggerFactory.getLogger(this.getClass());

    private final long firstDelay;
    private final int maxRetries;
    private final int factor;
    private final TimeUnit unit;

    private int retryCount;

    public ExponentialDelayFlow(long firstDelay, int maxRetries, int factor, TimeUnit unit) {
        this.firstDelay = firstDelay;
        this.maxRetries = maxRetries;
        this.factor = factor;
        this.unit = unit;
        this.retryCount = 0;
    }

    @Override
    public Publisher<?>  apply(Flowable<Throwable> throwableFlowable) throws Exception {
        return throwableFlowable.flatMap((Function<Throwable, Publisher<?>>) throwable -> {

            long compute = compute(firstDelay, retryCount, factor, unit);


            if(++retryCount < maxRetries) {
                logger.info("Retrying it.... "+ throwable.getMessage());
                return Flowable.timer(compute, TimeUnit.MILLISECONDS);
            }

            logger.error("Retrying it.... "+ throwable.getMessage());
            return Flowable.error(throwable);
        });
    }

    private long compute(final long firstDelay, final int retryCount, final double factor, TimeUnit unit) {
        return Math.round(Math.pow(factor, retryCount) * unit.toMillis(firstDelay));
    }
}
