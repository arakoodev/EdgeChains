package com.app.rxjava.retry;

import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.functions.Function;

import java.io.Serializable;

public abstract class RetryPolicy
    implements Function<Observable<? extends Throwable>, Observable<?>>, Serializable {

  private static final long serialVersionUID = -3531903621076848363L;
}
