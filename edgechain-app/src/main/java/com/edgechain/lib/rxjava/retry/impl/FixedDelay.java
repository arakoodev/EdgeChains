package com.edgechain.lib.rxjava.retry.impl;

import com.edgechain.lib.rxjava.retry.RetryPolicy;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.functions.Function;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.TimeUnit;

public class FixedDelay extends RetryPolicy {

  private final Logger logger = LoggerFactory.getLogger(this.getClass());

  private int maxRetries = 4;
  private int retryDelay = 3;
  private TimeUnit unit = TimeUnit.SECONDS;
  private int retryCount;

  public FixedDelay() {
  }

  public FixedDelay(int maxRetries, int retryDelay, TimeUnit unit) {
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
    this.unit = unit;
    this.retryCount = 0;
  }

  @Override
  public Observable<?> apply(final Observable<? extends Throwable> attempts) {
    return attempts.flatMap(
        (Function<Throwable, Observable<?>>)
            throwable -> {
              if (++retryCount < maxRetries) {
                // Unsubscribe the original observable & resubscribed it.
                logger.info("Retrying it.... " + throwable.getMessage());
                return Observable.timer(unit.toMillis(retryDelay), TimeUnit.MILLISECONDS);
              }

              // Once, max-retries hit, emit an error.
              logger.error(throwable.getMessage());
              return Observable.error(throwable);
            });
  }

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("FixedDelay{");
    sb.append("maxRetries=").append(maxRetries);
    sb.append(", retryDelay=").append(retryDelay);
    sb.append(", unit=").append(unit);
    sb.append('}');
    return sb.toString();
  }

  public int getMaxRetries() {
    return maxRetries;
  }

  public int getRetryDelay() {
    return retryDelay;
  }

  public TimeUnit getUnit() {
    return unit;
  }
}
