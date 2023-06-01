package com.edgechain.lib.rxjava.retry;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.functions.Function;

import java.io.Serializable;

@JsonTypeInfo(use = JsonTypeInfo.Id.CLASS)
public abstract class RetryPolicy
    implements Function<Observable<? extends Throwable>, Observable<?>>, Serializable {

  private static final long serialVersionUID = -3531903621076848363L;
}
