package com.app.rxjava.retry.impl;

import com.app.rxjava.retry.RetryPolicy;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.functions.Function;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.TimeUnit;

public class ExponentialDelay extends RetryPolicy {

  private final Logger logger = LoggerFactory.getLogger(this.getClass());
  private final long firstDelay;
  private final int maxRetries;
  private final int factor;
  private final TimeUnit unit;
  private int retryCount;

  public ExponentialDelay(long firstDelay, int maxRetries, int factor, TimeUnit unit) {
    this.firstDelay = firstDelay;
    this.maxRetries = maxRetries;
    this.factor = factor;
    this.unit = unit;
  }

  @Override
  public Observable<?> apply(Observable<? extends Throwable> observable) throws Throwable {
    return observable.flatMap(
        (Function<Throwable, Observable<?>>)
            throwable -> {
              long compute = compute(firstDelay, retryCount, factor, unit);

              if (++retryCount < maxRetries) {
                logger.info("Retrying it.... " + throwable.getMessage());
                return Observable.timer(compute, TimeUnit.MILLISECONDS);
              }

              logger.error(throwable.getMessage());
              return Observable.error(throwable);
            });
  }

  private long compute(
      final long firstDelay, final int retryCount, final double factor, TimeUnit unit) {
    return Math.round(Math.pow(factor, retryCount) * unit.toMillis(firstDelay));
  }
}
