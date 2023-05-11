package com.app.openaiwiki.retry;

import com.app.rxjava.retry.impl.ExponentialDelay;
import com.app.rxjava.retry.impl.FixedDelay;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.observers.TestObserver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

public class RetryWhenTest {

  private List<Integer> integerList;
  AtomicInteger count;

  // Arrange
  @BeforeEach
  public void setup() {
    integerList = Arrays.asList(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
    count = new AtomicInteger(0);
  }

  @Test
  @DisplayName("Retry With FixedDelayStrategy")
  void testRetryWhen_FixedDelayStrategy_ShouldBeResubscribed() throws InterruptedException {

    // Act --> Objective is to emit & then resubscribe i.e., connection is established
    TestObserver<Object> test =
        Observable.create(
                emitter -> {
                  try {
                    for (Integer i : integerList) {
                      Thread.sleep(500); // Adding Delay of 500ms

                      count.getAndIncrement();
                      if (count.get() < 5) throw new RuntimeException("Bad Data...");

                      emitter.onNext(i);
                    }
                    emitter.onComplete();

                  } catch (final Exception e) {
                    emitter.onError(e);
                  }
                })
            .retryWhen(new FixedDelay(6, 1, TimeUnit.SECONDS))
            .test();

    test.await();

    //        System.out.println(test.values());

    // Assert
    test.assertValues(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
    test.assertValueCount(integerList.size());
  }

  @Test
  @DisplayName("Retry With ExponentialDelayStrategy")
  void testRetryWhen_ExponentialDelay_ShouldBeResubscribed() throws InterruptedException {

    // Act --> Objective is to emit & then resubscribe i.e., connection is established
    TestObserver<Object> test =
        Observable.create(
                emitter -> {
                  try {
                    for (Integer i : integerList) {
                      Thread.sleep(500); // Adding Delay of 100ms

                      count.getAndIncrement();
                      if (count.get() < 5) throw new RuntimeException("Bad Data...");

                      emitter.onNext(i);
                    }
                    emitter.onComplete();

                  } catch (final Exception e) {
                    emitter.onError(e);
                  }
                })
            .retryWhen(new ExponentialDelay(1, 5, 2, TimeUnit.SECONDS))
            .test();

    test.await();

    System.out.println(test.values());

    // Assert
    test.assertValues(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);
    test.assertValueCount(integerList.size());
  }
}
