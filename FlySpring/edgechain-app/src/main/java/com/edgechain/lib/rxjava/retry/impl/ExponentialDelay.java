package com.edgechain.lib.rxjava.retry.impl;

import com.edgechain.lib.rxjava.retry.RetryPolicy;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.functions.Function;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.TimeUnit;

public class ExponentialDelay extends RetryPolicy {

  private final Logger logger = LoggerFactory.getLogger(this.getClass());
  private long firstDelay;
  private int maxRetries;
  private int factor;
  private TimeUnit unit = TimeUnit.SECONDS;
  private int retryCount;

  public ExponentialDelay() {}

  public ExponentialDelay(long firstDelay, int maxRetries, int factor, TimeUnit unit) {
    this.firstDelay = firstDelay;
    this.maxRetries = maxRetries;
    this.factor = factor;
    this.unit = unit;
    this.retryCount = 0;
  }

  @Override
  public Observable<?> apply(Observable<? extends Throwable> observable) throws Throwable {
    return observable.flatMap(
        (Function<Throwable, Observable<?>>)
            throwable -> {
              if (throwable.getMessage().contains("The mapper function returned a null value")
                  || throwable
                      .getMessage()
                      .contains(
                          "JSON decoding error: Cannot deserialize value of type"
                              + " `com.edgechain.lib.openai.response.ChatCompletionResponse` from"
                              + " Array value (token `JsonToken.START_ARRAY`)"))
                return Observable.empty();

              long compute = compute(firstDelay, retryCount, factor, unit);

              if (++retryCount < maxRetries) {
                logger.info(
                    String.format(
                        "Retrying: Attempt: %s, Max Retries: %s ~ %s",
                        retryCount, maxRetries, throwable.getMessage()));
                return Observable.timer(compute, TimeUnit.MILLISECONDS);
              }

              logger.error(
                  String.format(
                      "Error Occurred: Attempt: %s, Max Retries: %s ~ %s",
                      retryCount, maxRetries, throwable.getMessage()));
              return Observable.error(throwable);
            });
  }

  private long compute(
      final long firstDelay, final int retryCount, final double factor, TimeUnit unit) {
    return Math.round(Math.pow(factor, retryCount) * unit.toMillis(firstDelay));
  }

  public long getFirstDelay() {
    return firstDelay;
  }

  public int getMaxRetries() {
    return maxRetries;
  }

  public int getFactor() {
    return factor;
  }

  public TimeUnit getUnit() {
    return unit;
  }

  @Override
  public String toString() {
    final StringBuilder sb = new StringBuilder("ExponentialDelay{");
    sb.append("firstDelay=").append(firstDelay);
    sb.append(", maxRetries=").append(maxRetries);
    sb.append(", factor=").append(factor);
    sb.append(", unit=").append(unit);
    sb.append('}');
    return sb.toString();
  }
}
